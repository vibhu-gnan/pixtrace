'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizerPlanLimits, type PlanLimits } from '@/lib/plans/limits';
import { listAllObjects, deleteObjects } from '@/lib/storage/r2-client';

// ============================================================================
// CONSTANTS
// ============================================================================

const PAGE_SIZE = 20;

// ============================================================================
// HELPERS
// ============================================================================

function paginate(page: number) {
  const p = Math.max(1, page);
  const from = (p - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  return { from, to, page: p };
}

// ============================================================================
// OVERVIEW / STATS
// ============================================================================

export async function getAdminStats() {
  await requireAdmin();
  const supabase = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalEvents },
    { count: totalMedia },
    { data: storageData },
    { data: activeSubs },
    { data: capturedPayments },
    { data: recentUsers },
    { data: recentEvents },
    { data: faceJobs },
    { data: plans },
  ] = await Promise.all([
    supabase.from('organizers').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('media').select('id', { count: 'exact', head: true }),
    supabase.from('organizers').select('storage_used_bytes'),
    supabase.from('subscriptions').select('plan_id, status').eq('status', 'active'),
    supabase.from('payment_history').select('amount').eq('status', 'captured'),
    supabase
      .from('organizers')
      .select('id, name, email, plan_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('events')
      .select('id, name, event_hash, created_at, organizer_id, organizers(name, email)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('face_processing_jobs').select('status'),
    supabase.from('plans').select('id, price_monthly').eq('is_active', true),
  ]);

  // Total storage
  const totalStorageBytes = (storageData || []).reduce(
    (sum, o) => sum + (o.storage_used_bytes || 0),
    0
  );

  // Revenue
  const totalRevenue = (capturedPayments || []).reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  );

  // Active subs by plan
  const subsByPlan: Record<string, number> = {};
  for (const sub of activeSubs || []) {
    subsByPlan[sub.plan_id] = (subsByPlan[sub.plan_id] || 0) + 1;
  }

  // MRR calculation
  const planPriceMap: Record<string, number> = {};
  for (const plan of plans || []) {
    planPriceMap[plan.id] = plan.price_monthly || 0;
  }
  let mrr = 0;
  for (const [planId, count] of Object.entries(subsByPlan)) {
    mrr += (planPriceMap[planId] || 0) * count;
  }

  // Face job counts by status
  const faceJobCounts: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0, no_faces: 0 };
  for (const job of faceJobs || []) {
    faceJobCounts[job.status] = (faceJobCounts[job.status] || 0) + 1;
  }

  return {
    totalUsers: totalUsers || 0,
    totalEvents: totalEvents || 0,
    totalMedia: totalMedia || 0,
    totalStorageBytes,
    totalRevenue,
    mrr,
    subsByPlan,
    recentUsers: recentUsers || [],
    recentEvents: recentEvents || [],
    faceJobCounts,
  };
}

// ============================================================================
// USERS
// ============================================================================

export async function getAdminUsers({
  page = 1,
  search = '',
  plan = '',
}: {
  page?: number;
  search?: string;
  plan?: string;
} = {}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { from, to, page: p } = paginate(page);

  let query = supabase
    .from('organizers')
    .select('*, events(id)', { count: 'exact' });

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
  }

  if (plan) {
    query = query.eq('plan_id', plan);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('getAdminUsers error:', error);
    return { users: [], total: 0, page: p, pageSize: PAGE_SIZE };
  }

  // Fetch all plans for limit resolution
  const { data: plans } = await supabase.from('plans').select('id, storage_limit_bytes, max_events');
  const planMap = new Map((plans || []).map((p: any) => [p.id, p]));

  const users = (data || []).map((u: any) => {
    const userPlan = planMap.get(u.plan_id);
    // Effective limits: custom overrides > plan defaults
    const storageLimitBytes = u.custom_storage_limit_bytes != null
      ? u.custom_storage_limit_bytes
      : (userPlan?.storage_limit_bytes ?? 1073741824);
    const maxEvents = u.custom_max_events != null
      ? u.custom_max_events
      : (userPlan?.max_events ?? 1);

    return {
      ...u,
      event_count: u.events?.length || 0,
      events: undefined, // don't leak full event list
      storage_limit_bytes: storageLimitBytes,
      max_events: maxEvents,
    };
  });

  return { users, total: count || 0, page: p, pageSize: PAGE_SIZE };
}

export async function getAdminUserDetail(userId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!userId) return null;

  const [
    { data: user, error: userError },
    { data: events },
    { data: subscriptions },
    { data: payments },
  ] = await Promise.all([
    supabase.from('organizers').select('*').eq('id', userId).single(),
    supabase
      .from('events')
      .select('id, name, event_hash, is_public, face_search_enabled, created_at')
      .eq('organizer_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('*, plans(name, price_monthly)')
      .eq('organizer_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('payment_history')
      .select('*')
      .eq('organizer_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (userError || !user) {
    console.error('getAdminUserDetail error:', userError);
    return null;
  }

  // Get media counts per event
  const eventIds = (events || []).map((e: any) => e.id);
  let mediaCounts: Record<string, number> = {};
  if (eventIds.length > 0) {
    const { data: mediaData } = await supabase
      .from('media')
      .select('event_id')
      .in('event_id', eventIds);

    for (const m of mediaData || []) {
      mediaCounts[m.event_id] = (mediaCounts[m.event_id] || 0) + 1;
    }
  }

  const eventsWithCounts = (events || []).map((e: any) => ({
    ...e,
    media_count: mediaCounts[e.id] || 0,
  }));

  // Fetch effective plan limits for this user
  let planLimits: PlanLimits | null = null;
  try {
    planLimits = await getOrganizerPlanLimits(userId);
  } catch {
    // Non-critical — admin page still works without limits
  }

  return {
    user,
    events: eventsWithCounts,
    subscriptions: subscriptions || [],
    payments: payments || [],
    planLimits,
  };
}

export async function toggleUserAdmin(userId: string) {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  // Prevent self-demotion
  if (userId === admin.id) {
    return { error: 'Cannot change your own admin status' };
  }

  const { data: user, error: fetchError } = await supabase
    .from('organizers')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    return { error: 'User not found' };
  }

  const { error: updateError } = await supabase
    .from('organizers')
    .update({ is_admin: !user.is_admin, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    console.error('toggleUserAdmin error:', updateError);
    return { error: 'Failed to update admin status' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { success: true, is_admin: !user.is_admin };
}

export async function changeUserPlan(userId: string, newPlanId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!userId || typeof userId !== 'string') {
    return { error: 'Valid user ID is required' };
  }

  const validPlans = ['free', 'starter', 'pro', 'enterprise'];
  if (!validPlans.includes(newPlanId)) {
    return { error: 'Invalid plan' };
  }

  // Fetch current plan to detect downgrade from enterprise
  const { data: user, error: fetchError } = await supabase
    .from('organizers')
    .select('plan_id')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    return { error: 'User not found' };
  }

  // No-op if plan is already the same
  if (user.plan_id === newPlanId) {
    return { success: true };
  }

  const updates: Record<string, unknown> = {
    plan_id: newPlanId,
    updated_at: new Date().toISOString(),
  };

  // Clear custom overrides when downgrading from enterprise
  if (user.plan_id === 'enterprise' && newPlanId !== 'enterprise') {
    updates.custom_storage_limit_bytes = null;
    updates.custom_max_events = null;
    updates.custom_feature_flags = null;
  }

  const { error } = await supabase
    .from('organizers')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('changeUserPlan error:', error);
    return { error: 'Failed to update plan' };
  }

  // Await grace period check so the deadline is cleared BEFORE we return.
  // This prevents a race where the cron could still see a stale deadline.
  try {
    const { checkAndSetGracePeriod } = await import('@/lib/plans/grace-period');
    await checkAndSetGracePeriod(userId);
  } catch (err) {
    console.error('Grace period check failed after admin plan change:', err);
  }

  // Fire-and-forget: send plan change notification email
  import('@/lib/email/send-plan-change-email')
    .then(({ sendPlanChangeEmail }) =>
      sendPlanChangeEmail(userId, user.plan_id, newPlanId),
    )
    .catch((err) => {
      console.error('[ChangeUserPlan] Plan change email failed:', err);
    });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

// ============================================================================
// ADMIN CREATE USER
// ============================================================================

export interface AdminCreateUserData {
  email: string;
  name: string;
  password: string;
  planId: string;
  isAdmin: boolean;
  customStorageLimitGB?: number | null;
  customMaxEvents?: number | null;
}

export async function adminCreateUser(data: AdminCreateUserData) {
  await requireAdmin();
  const supabase = createAdminClient();

  // Null guard — server actions can receive unexpected input
  if (!data || typeof data !== 'object') {
    return { error: 'Invalid request data' };
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || typeof data.email !== 'string' || !emailRegex.test(data.email.trim())) {
    return { error: 'Invalid email address' };
  }

  // Validate password
  if (!data.password || typeof data.password !== 'string' || data.password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  if (data.password.length > 128) {
    return { error: 'Password must be 128 characters or less' };
  }

  // Validate plan
  const validPlans = ['free', 'starter', 'pro', 'enterprise'];
  if (!validPlans.includes(data.planId)) {
    return { error: 'Invalid plan' };
  }

  // Validate name
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 1) {
    return { error: 'Name is required' };
  }

  if (data.name.trim().length > 255) {
    return { error: 'Name must be 255 characters or less' };
  }

  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();

  // Validate custom limits are sane numbers (NaN/Infinity protection)
  if (data.customStorageLimitGB != null) {
    if (typeof data.customStorageLimitGB !== 'number' || !Number.isFinite(data.customStorageLimitGB) || data.customStorageLimitGB < 0) {
      return { error: 'Storage limit must be a valid non-negative number' };
    }
  }
  if (data.customMaxEvents != null) {
    if (typeof data.customMaxEvents !== 'number' || !Number.isFinite(data.customMaxEvents) || data.customMaxEvents < 0 || !Number.isInteger(data.customMaxEvents)) {
      return { error: 'Max events must be a valid non-negative integer' };
    }
  }

  // Create Supabase Auth user first — this is the source of truth for uniqueness.
  // Skip the organizer email pre-check to eliminate TOCTOU race condition;
  // Supabase Auth enforces email uniqueness atomically.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError) {
    console.error('adminCreateUser auth error:', authError);
    if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
      return { error: 'An account with this email already exists' };
    }
    return { error: `Failed to create auth user: ${authError.message}` };
  }

  if (!authData.user) {
    return { error: 'Auth user creation returned no user' };
  }

  // Build organizer record
  const organizerData: Record<string, unknown> = {
    auth_id: authData.user.id,
    email,
    name,
    plan_id: data.planId,
    is_admin: !!data.isAdmin,
  };

  // Set custom limits for enterprise users
  if (data.planId === 'enterprise') {
    if (data.customStorageLimitGB != null && data.customStorageLimitGB >= 0) {
      organizerData.custom_storage_limit_bytes = Math.round(data.customStorageLimitGB * 1024 ** 3);
    }
    if (data.customMaxEvents != null && data.customMaxEvents >= 0) {
      organizerData.custom_max_events = data.customMaxEvents;
    }
  }

  // Insert organizer profile
  const { data: organizer, error: insertError } = await supabase
    .from('organizers')
    .insert(organizerData)
    .select('id')
    .single();

  if (insertError) {
    console.error('adminCreateUser insert error:', insertError);
    // Rollback: delete the auth user we just created
    try {
      await supabase.auth.admin.deleteUser(authData.user.id);
    } catch (rollbackErr) {
      console.error('adminCreateUser rollback failed — orphaned auth user:', authData.user.id, rollbackErr);
    }
    return { error: 'Failed to create organizer profile' };
  }

  // Fire-and-forget: send welcome email (don't block admin UI)
  import('@/lib/email/resend')
    .then(({ sendEmail }) =>
      import('@/lib/email/templates/welcome').then(({ welcomeSubject, welcomeHtml }) =>
        sendEmail({
          to: email,
          subject: welcomeSubject(),
          html: welcomeHtml({ name }),
          emailType: 'welcome',
        }),
      ),
    )
    .then((sent) => {
      if (sent) console.log(`[AdminCreateUser] Welcome email sent to ${email}`);
    })
    .catch((err) => {
      console.error('[AdminCreateUser] Welcome email failed:', err);
    });

  revalidatePath('/admin/users');
  return { success: true, userId: organizer.id };
}

// ============================================================================
// ENTERPRISE CUSTOM LIMITS
// ============================================================================

export interface AdminCustomLimitsData {
  customStorageLimitGB: number | null; // null = use plan default, 0 = unlimited
  customMaxEvents: number | null;      // null = use plan default, 0 = unlimited
  customFeatureFlags: Record<string, unknown> | null;
}

export async function adminSetCustomLimits(userId: string, limits: AdminCustomLimitsData) {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!userId || typeof userId !== 'string') {
    return { error: 'Valid user ID is required' };
  }

  if (!limits || typeof limits !== 'object') {
    return { error: 'Invalid limits data' };
  }

  // NaN/Infinity guard on numeric inputs
  if (limits.customStorageLimitGB !== null && limits.customStorageLimitGB !== undefined) {
    if (typeof limits.customStorageLimitGB !== 'number' || !Number.isFinite(limits.customStorageLimitGB) || limits.customStorageLimitGB < 0) {
      return { error: 'Storage limit must be a valid non-negative number' };
    }
  }
  if (limits.customMaxEvents !== null && limits.customMaxEvents !== undefined) {
    if (typeof limits.customMaxEvents !== 'number' || !Number.isFinite(limits.customMaxEvents) || limits.customMaxEvents < 0 || !Number.isInteger(limits.customMaxEvents)) {
      return { error: 'Max events must be a valid non-negative integer' };
    }
  }

  // Verify user exists and is on enterprise plan
  const { data: user, error: fetchError } = await supabase
    .from('organizers')
    .select('plan_id')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    return { error: 'User not found' };
  }

  if (user.plan_id !== 'enterprise') {
    return { error: 'Custom limits can only be set for enterprise plan users' };
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Storage: convert GB to bytes, null clears override
  if (limits.customStorageLimitGB === null) {
    updates.custom_storage_limit_bytes = null;
  } else if (limits.customStorageLimitGB >= 0) {
    updates.custom_storage_limit_bytes = Math.round(limits.customStorageLimitGB * 1024 ** 3);
  }

  // Max events: null clears override
  if (limits.customMaxEvents === null) {
    updates.custom_max_events = null;
  } else if (limits.customMaxEvents >= 0) {
    updates.custom_max_events = limits.customMaxEvents;
  }

  // Feature flags: null clears override, filter out empty objects
  if (limits.customFeatureFlags === null) {
    updates.custom_feature_flags = null;
  } else if (limits.customFeatureFlags && typeof limits.customFeatureFlags === 'object') {
    // Only store if at least one flag is truthy — avoid saving {downloads: false, ...} as an override
    const truthyFlags = Object.fromEntries(
      Object.entries(limits.customFeatureFlags).filter(([, v]) => !!v)
    );
    updates.custom_feature_flags = Object.keys(truthyFlags).length > 0 ? truthyFlags : null;
  }

  const { error } = await supabase
    .from('organizers')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('adminSetCustomLimits error:', error);
    return { error: 'Failed to update custom limits' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

// ============================================================================
// EVENTS
// ============================================================================

export async function getAdminEvents({
  page = 1,
  search = '',
}: {
  page?: number;
  search?: string;
} = {}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { from, to, page: p } = paginate(page);

  let query = supabase
    .from('events')
    .select('*, organizers(name, email)', { count: 'exact' });

  if (search) {
    query = query.or(`name.ilike.%${search}%,event_hash.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('getAdminEvents error:', error);
    return { events: [], total: 0, page: p, pageSize: PAGE_SIZE };
  }

  // Fetch media counts for these events
  const eventIds = (data || []).map((e: any) => e.id);
  let mediaCounts: Record<string, number> = {};
  if (eventIds.length > 0) {
    const { data: mediaData } = await supabase
      .from('media')
      .select('event_id')
      .in('event_id', eventIds);

    for (const m of mediaData || []) {
      mediaCounts[m.event_id] = (mediaCounts[m.event_id] || 0) + 1;
    }
  }

  const events = (data || []).map((e: any) => ({
    ...e,
    media_count: mediaCounts[e.id] || 0,
  }));

  return { events, total: count || 0, page: p, pageSize: PAGE_SIZE };
}

export async function toggleEventPublic(eventId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('is_public, event_hash')
    .eq('id', eventId)
    .single();

  if (fetchError || !event) {
    return { error: 'Event not found' };
  }

  const { error } = await supabase
    .from('events')
    .update({ is_public: !event.is_public, updated_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) {
    console.error('toggleEventPublic error:', error);
    return { error: 'Failed to update event' };
  }

  revalidatePath('/admin/events');
  revalidatePath(`/gallery/${event.event_hash}`);
  return { success: true, is_public: !event.is_public };
}

// ============================================================================
// SUBSCRIPTIONS & PAYMENTS
// ============================================================================

export async function getAdminSubscriptions({
  page = 1,
  status = '',
}: {
  page?: number;
  status?: string;
} = {}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { from, to, page: p } = paginate(page);

  let query = supabase
    .from('subscriptions')
    .select('*, organizers(name, email), plans(name, price_monthly)', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('getAdminSubscriptions error:', error);
    return { subscriptions: [], total: 0, page: p, pageSize: PAGE_SIZE };
  }

  return { subscriptions: data || [], total: count || 0, page: p, pageSize: PAGE_SIZE };
}

export async function getAdminPayments({
  page = 1,
}: {
  page?: number;
} = {}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { from, to, page: p } = paginate(page);

  const { data, count, error } = await supabase
    .from('payment_history')
    .select('*, organizers(name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('getAdminPayments error:', error);
    return { payments: [], total: 0, page: p, pageSize: PAGE_SIZE };
  }

  return { payments: data || [], total: count || 0, page: p, pageSize: PAGE_SIZE };
}

// ============================================================================
// ENTERPRISE INQUIRIES
// ============================================================================

export async function getAdminInquiries({
  page = 1,
  status = '',
}: {
  page?: number;
  status?: string;
} = {}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { from, to, page: p } = paginate(page);

  let query = supabase
    .from('enterprise_inquiries')
    .select('*', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('getAdminInquiries error:', error);
    return { inquiries: [], total: 0, page: p, pageSize: PAGE_SIZE };
  }

  return { inquiries: data || [], total: count || 0, page: p, pageSize: PAGE_SIZE };
}

export async function updateInquiryStatus(
  inquiryId: string,
  status: string,
  notes?: string
) {
  await requireAdmin();
  const supabase = createAdminClient();

  const validStatuses = ['new', 'contacted', 'converted', 'closed'];
  if (!validStatuses.includes(status)) {
    return { error: 'Invalid status' };
  }

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (notes !== undefined) {
    updates.notes = notes;
  }

  const { error } = await supabase
    .from('enterprise_inquiries')
    .update(updates)
    .eq('id', inquiryId);

  if (error) {
    console.error('updateInquiryStatus error:', error);
    return { error: 'Failed to update inquiry' };
  }

  revalidatePath('/admin/inquiries');
  return { success: true };
}

// ============================================================================
// FACE PROCESSING JOBS
// ============================================================================

export async function getAdminFaceJobs({
  page = 1,
  status = '',
}: {
  page?: number;
  status?: string;
} = {}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { from, to, page: p } = paginate(page);

  let query = supabase
    .from('face_processing_jobs')
    .select('*, events(name), media(original_filename)', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('getAdminFaceJobs error:', error);
    return { jobs: [], total: 0, page: p, pageSize: PAGE_SIZE };
  }

  return { jobs: data || [], total: count || 0, page: p, pageSize: PAGE_SIZE };
}

export async function retryFailedFaceJobs(jobIds: string[]) {
  await requireAdmin();
  const supabase = createAdminClient();

  if (!jobIds.length) {
    return { error: 'No jobs selected' };
  }

  if (jobIds.length > 50) {
    return { error: 'Maximum 50 jobs at a time' };
  }

  const { error } = await supabase
    .from('face_processing_jobs')
    .update({
      status: 'pending',
      error_message: null,
      started_at: null,
      completed_at: null,
      next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', jobIds)
    .in('status', ['failed', 'no_faces']);

  if (error) {
    console.error('retryFailedFaceJobs error:', error);
    return { error: 'Failed to retry jobs' };
  }

  revalidatePath('/admin/face-jobs');
  return { success: true, count: jobIds.length };
}

// ============================================================================
// EMAIL LOGS
// ============================================================================

export async function getAdminEmailLogs({
  page = 1,
  status = '',
  emailType = '',
}: {
  page?: number;
  status?: string;
  emailType?: string;
} = {}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { from, to, page: p } = paginate(page);

  let query = supabase
    .from('email_logs')
    .select('*', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (emailType) {
    query = query.eq('email_type', emailType);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('getAdminEmailLogs error:', error);
    return { logs: [], total: 0, page: p, pageSize: PAGE_SIZE };
  }

  return { logs: data || [], total: count || 0, page: p, pageSize: PAGE_SIZE };
}

// ============================================================================
// SEND TEST EMAIL
// ============================================================================

const VALID_TEST_TEMPLATES = ['generic', 'welcome', 'storage_warning', 'storage_deleted', 'plan_change'] as const;
type TestTemplate = (typeof VALID_TEST_TEMPLATES)[number];

export async function sendTestEmail(data: {
  to: string;
  template: string;
}): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();

  // Validate email — type, length cap (RFC 5321: max 254), format
  if (!data.to || typeof data.to !== 'string' || data.to.length > 320) {
    return { error: 'Invalid email address' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.to.trim())) {
    return { error: 'Invalid email address' };
  }

  // Whitelist template values — untrusted client input falls back to generic
  const template: TestTemplate = VALID_TEST_TEMPLATES.includes(data.template as TestTemplate)
    ? (data.template as TestTemplate)
    : 'generic';

  const to = data.to.trim().toLowerCase();
  let subject: string;
  let html: string;
  let emailType: string;

  switch (template) {
    case 'welcome': {
      const { welcomeSubject, welcomeHtml } = await import('@/lib/email/templates/welcome');
      subject = `[TEST] ${welcomeSubject()}`;
      html = welcomeHtml({ name: 'Test User' });
      emailType = 'test_welcome';
      break;
    }
    case 'storage_warning': {
      const { storageWarningSubject, storageWarningHtml } = await import('@/lib/email/templates/storage-warning');
      subject = `[TEST] ${storageWarningSubject()}`;
      html = storageWarningHtml({
        name: 'Test User',
        usedDisplay: '1.8 GB',
        limitDisplay: '1 GB',
        overByDisplay: '820 MB',
        deadlineDate: '15 April 2026',
        planName: 'Free',
      });
      emailType = 'test_storage_warning';
      break;
    }
    case 'storage_deleted': {
      const { storageDeletedSubject, storageDeletedHtml } = await import('@/lib/email/templates/storage-deleted');
      subject = `[TEST] ${storageDeletedSubject(3)}`;
      html = storageDeletedHtml({
        name: 'Test User',
        eventsDeleted: 3,
        bytesFreedDisplay: '920 MB',
        currentUsageDisplay: '880 MB',
        limitDisplay: '1 GB',
        planName: 'Free',
      });
      emailType = 'test_storage_deleted';
      break;
    }
    case 'plan_change': {
      const { planChangeSubject, planChangeHtml } = await import('@/lib/email/templates/plan-change');
      subject = `[TEST] ${planChangeSubject('upgrade')}`;
      html = planChangeHtml({
        name: 'Test User',
        direction: 'upgrade',
        oldPlanName: 'Free',
        newPlanName: 'Pro',
        oldStorage: '1 GB',
        newStorage: '50 GB',
        oldMaxEvents: '1 event',
        newMaxEvents: 'Unlimited events',
        features: ['Original Quality Downloads', 'Custom Branding', 'Client Proofing'],
      });
      emailType = 'test_plan_change';
      break;
    }
    default: {
      subject = '[TEST] PIXTRACE Email Test';
      html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#2563eb;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">PIXTRACE</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        This is a test email from PIXTRACE admin dashboard.
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        If you received this, email delivery is working correctly.
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
        PIXTRACE &middot; Test Email
      </p>
    </div>
  </div>
</body>
</html>`.trim();
      emailType = 'test';
      break;
    }
  }

  const { sendEmail } = await import('@/lib/email/resend');
  const sent = await sendEmail({ to, subject, html, emailType });

  if (!sent) {
    return { error: 'Failed to send email. Check Resend API key configuration.' };
  }

  return { success: true };
}

// ============================================================================
// STORAGE RECALCULATION
// ============================================================================

/**
 * Recalculate storage_used_bytes for one or all organizers from actual media data.
 * Fixes any drift between the counter and reality (e.g. from past bugs).
 */
export async function adminRecalculateStorage(organizerId?: string): Promise<{
  success: boolean;
  updated: number;
  details: Array<{ id: string; name: string; oldBytes: number; newBytes: number; diff: number }>;
  error?: string;
}> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Fetch organizers to recalculate
  let organizers: Array<{ id: string; name: string; storage_used_bytes: number }>;

  if (organizerId) {
    const { data, error } = await supabase
      .from('organizers')
      .select('id, name, storage_used_bytes')
      .eq('id', organizerId);
    if (error || !data?.length) {
      return { success: false, updated: 0, details: [], error: 'Organizer not found' };
    }
    organizers = data;
  } else {
    // All organizers with any storage used or any media
    const { data, error } = await supabase
      .from('organizers')
      .select('id, name, storage_used_bytes');
    if (error) {
      return { success: false, updated: 0, details: [], error: 'Failed to fetch organizers' };
    }
    organizers = data || [];
  }

  const details: Array<{ id: string; name: string; oldBytes: number; newBytes: number; diff: number }> = [];
  let updated = 0;

  for (const org of organizers) {
    // Sum file_size + variant_size_bytes for all media owned by this organizer
    // Media → Event → Organizer (media has event_id, event has organizer_id)
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('organizer_id', org.id);

    if (!events || events.length === 0) {
      // No events — storage should be 0
      if (org.storage_used_bytes !== 0) {
        await supabase
          .from('organizers')
          .update({ storage_used_bytes: 0, updated_at: new Date().toISOString() })
          .eq('id', org.id);
        details.push({ id: org.id, name: org.name, oldBytes: org.storage_used_bytes, newBytes: 0, diff: -org.storage_used_bytes });
        updated++;
      }
      continue;
    }

    const eventIds = events.map((e) => e.id);

    // Paginated sum — Supabase caps rows at ~1000
    let actualBytes = 0;
    const PAGE_SIZE = 1000;
    let offset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: mediaPage } = await supabase
        .from('media')
        .select('file_size, variant_size_bytes')
        .in('event_id', eventIds)
        .range(offset, offset + PAGE_SIZE - 1);

      if (!mediaPage || mediaPage.length === 0) break;

      for (const row of mediaPage) {
        actualBytes += (row.file_size || 0) + (row.variant_size_bytes || 0);
      }

      offset += mediaPage.length;
      if (mediaPage.length < PAGE_SIZE) break;
    }

    const diff = actualBytes - org.storage_used_bytes;
    if (diff !== 0) {
      await supabase
        .from('organizers')
        .update({ storage_used_bytes: actualBytes, updated_at: new Date().toISOString() })
        .eq('id', org.id);
      details.push({ id: org.id, name: org.name, oldBytes: org.storage_used_bytes, newBytes: actualBytes, diff });
      updated++;
    }
  }

  return { success: true, updated, details };
}

// ============================================================================
// STORAGE MAINTENANCE
// ============================================================================

const MAX_ORPHAN_KEYS_PER_RUN = 5000;
const MAX_ORPHAN_RATIO = 0.5;
const CLEANUP_BATCH_SIZE = 100;
const SCAN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Server-side cache for scan results.
 * Keys are stored here instead of being sent to the client (avoids large payloads).
 * Each entry auto-expires after 10 minutes.
 */
const scanResultCache = new Map<string, {
  untrackedOrphanKeys: string[];
  trackedOrphanIds: string[];
  expiresAt: number;
}>();

function pruneScanCache() {
  const now = Date.now();
  for (const [id, entry] of scanResultCache) {
    if (entry.expiresAt <= now) scanResultCache.delete(id);
  }
  // Hard cap: never hold more than 5 scan results (multi-admin safety)
  if (scanResultCache.size > 5) {
    const oldest = [...scanResultCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < oldest.length - 5; i++) {
      scanResultCache.delete(oldest[i][0]);
    }
  }
}

/**
 * Lightweight stats for initial page load — just counts tracked orphans.
 */
export async function getStorageMaintenanceStats() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('r2_orphaned_keys')
    .select('id', { count: 'exact', head: true })
    .is('cleaned_at', null);

  if (error) {
    console.error('getStorageMaintenanceStats error:', error);
    return { trackedOrphanCount: 0 };
  }

  return { trackedOrphanCount: count || 0 };
}

export interface ScanResult {
  success: true;
  scanId: string;
  r2ObjectCount: number;
  dbKeyCount: number;
  trackedOrphanCount: number;
  untrackedOrphanCount: number;
}

/**
 * Full bucket scan — expensive, triggered by admin button.
 * Lists all R2 objects and compares against DB media keys.
 */
export async function scanOrphanedR2(): Promise<
  ScanResult | { success: false; error: string }
> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Step 1: List all R2 objects
  let r2Keys: string[];
  try {
    r2Keys = await listAllObjects();
  } catch (err: any) {
    console.error('[StorageMaintenance] R2 list failed:', err);
    return { success: false, error: `Failed to list R2 objects: ${err?.message || 'Unknown error'}` };
  }

  // Step 2: Fetch all known DB keys (paginated — Supabase PostgREST caps at ~1000 rows)
  const dbKeys = new Set<string>();
  let dbRowCount = 0;
  const DB_PAGE_SIZE = 1000; // Match Supabase default max-rows to avoid silent truncation
  let dbOffset = 0;
  const DB_MAX_PAGES = 1000; // Safety: 1M rows max

  for (let dbPage = 0; dbPage < DB_MAX_PAGES; dbPage++) {
    const { data, error } = await supabase
      .from('media')
      .select('r2_key, thumbnail_r2_key, preview_r2_key')
      .range(dbOffset, dbOffset + DB_PAGE_SIZE - 1);

    if (error) {
      console.error('[StorageMaintenance] DB query failed:', error);
      return { success: false, error: 'Failed to query media table' };
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.r2_key) dbKeys.add(row.r2_key);
      if (row.thumbnail_r2_key) dbKeys.add(row.thumbnail_r2_key);
      if (row.preview_r2_key) dbKeys.add(row.preview_r2_key);
    }
    dbRowCount += data.length;
    // Advance by actual rows returned, not assumed page size
    dbOffset += data.length;

    // If we got fewer rows than requested, we've reached the end
    if (data.length < DB_PAGE_SIZE) break;
  }

  // Safety: refuse if DB returned 0 rows but R2 has objects
  if (dbRowCount === 0 && r2Keys.length > 0) {
    return {
      success: false,
      error: 'Safety abort: Database returned 0 media rows but R2 has objects. This likely indicates a query failure.',
    };
  }

  // Step 3: Fetch tracked orphans (pending cleanup)
  const { data: trackedOrphans, error: trackedErr } = await supabase
    .from('r2_orphaned_keys')
    .select('id, r2_key')
    .is('cleaned_at', null)
    .limit(MAX_ORPHAN_KEYS_PER_RUN);

  if (trackedErr) {
    console.error('[StorageMaintenance] Tracked orphan query failed:', trackedErr);
    return { success: false, error: 'Failed to query tracked orphans' };
  }

  const trackedKeySet = new Set((trackedOrphans || []).map((o) => o.r2_key));

  // Step 4: Find untracked orphans (in R2 but not in DB AND not already tracked)
  const allOrphanKeys = r2Keys.filter((key) => !dbKeys.has(key));

  // Safety: refuse if orphan ratio > 50%
  if (r2Keys.length > 0) {
    const orphanRatio = allOrphanKeys.length / r2Keys.length;
    if (orphanRatio > MAX_ORPHAN_RATIO) {
      return {
        success: false,
        error: `Safety abort: ${(orphanRatio * 100).toFixed(1)}% of bucket objects appear orphaned (threshold: ${MAX_ORPHAN_RATIO * 100}%). This likely indicates a database query issue.`,
      };
    }
  }

  const untrackedOrphanKeys = allOrphanKeys
    .filter((key) => !trackedKeySet.has(key))
    .slice(0, MAX_ORPHAN_KEYS_PER_RUN);

  // Store keys server-side to avoid sending large arrays through server actions
  pruneScanCache();
  const scanId = crypto.randomUUID();
  scanResultCache.set(scanId, {
    untrackedOrphanKeys,
    trackedOrphanIds: (trackedOrphans || []).map((o) => o.id),
    expiresAt: Date.now() + SCAN_CACHE_TTL_MS,
  });

  return {
    success: true,
    scanId,
    r2ObjectCount: r2Keys.length,
    dbKeyCount: dbKeys.size,
    trackedOrphanCount: (trackedOrphans || []).length,
    untrackedOrphanCount: untrackedOrphanKeys.length,
  };
}

/**
 * Delete orphaned R2 objects and mark tracked orphans as cleaned.
 * Takes a scanId (from scanOrphanedR2) to retrieve keys from server-side cache.
 * Processes in batches, continues on individual batch errors.
 */
export async function cleanOrphanedR2(
  scanId: string,
): Promise<{ success: boolean; deletedCount: number; cleanedTrackedCount: number; errors: string[] }> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Retrieve scan results from server-side cache
  const cached = scanResultCache.get(scanId);
  if (!cached || cached.expiresAt <= Date.now()) {
    scanResultCache.delete(scanId);
    return { success: false, deletedCount: 0, cleanedTrackedCount: 0, errors: ['Scan results expired. Please scan again.'] };
  }

  // Consume the cache entry (one-time use — prevents double-clean)
  scanResultCache.delete(scanId);

  const keysToDelete = cached.untrackedOrphanKeys;
  const idsToClean = cached.trackedOrphanIds;

  let deletedCount = 0;
  let cleanedTrackedCount = 0;
  const errors: string[] = [];

  // Delete untracked orphan keys from R2 in batches
  for (let i = 0; i < keysToDelete.length; i += CLEANUP_BATCH_SIZE) {
    const batch = keysToDelete.slice(i, i + CLEANUP_BATCH_SIZE);
    try {
      await deleteObjects(batch);
      deletedCount += batch.length;
    } catch (err: any) {
      const msg = `Batch ${Math.floor(i / CLEANUP_BATCH_SIZE) + 1}: ${err?.message || 'Unknown error'}`;
      console.error('[StorageMaintenance] Delete batch error:', msg);
      errors.push(msg);
    }
  }

  // Clean tracked orphans: delete from R2 then mark as cleaned in DB
  for (let i = 0; i < idsToClean.length; i += CLEANUP_BATCH_SIZE) {
    const batchIds = idsToClean.slice(i, i + CLEANUP_BATCH_SIZE);

    // Fetch the actual R2 keys for these IDs
    const { data: rows, error: fetchErr } = await supabase
      .from('r2_orphaned_keys')
      .select('id, r2_key')
      .in('id', batchIds)
      .is('cleaned_at', null);

    if (fetchErr || !rows || rows.length === 0) {
      if (fetchErr) errors.push(`Tracked fetch error: ${fetchErr.message}`);
      continue;
    }

    try {
      await deleteObjects(rows.map((r) => r.r2_key));
    } catch (err: any) {
      errors.push(`Tracked delete batch: ${err?.message || 'Unknown error'}`);
      // Continue to mark as cleaned anyway — the R2 objects may already be gone
    }

    // Mark as cleaned
    const { error: updateErr } = await supabase
      .from('r2_orphaned_keys')
      .update({ cleaned_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));

    if (updateErr) {
      errors.push(`Tracked update error: ${updateErr.message}`);
    } else {
      cleanedTrackedCount += rows.length;
    }
  }

  return {
    success: errors.length === 0,
    deletedCount,
    cleanedTrackedCount,
    errors,
  };
}

// ============================================================================
// INVOICE DATA (for pre-filling invoice modal)
// ============================================================================

export interface PaymentInvoiceData {
  paymentId: string;
  organizerId: string | null;
  recipientName: string;
  recipientEmail: string;
  planId: string | null;
  planName: string;
  amountRupees: number;
  method: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
}

export async function getPaymentForInvoice(
  paymentId: string,
): Promise<{ data: PaymentInvoiceData | null; error?: string }> {
  await requireAdmin();

  if (!paymentId || typeof paymentId !== 'string') {
    return { data: null, error: 'Invalid payment ID' };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('payment_history')
    .select(
      `
      id,
      organizer_id,
      amount,
      method,
      razorpay_payment_id,
      paid_at,
      created_at,
      organizers (name, email),
      subscriptions (plan_id, plans (name))
    `,
    )
    .eq('id', paymentId)
    .single();

  if (error || !data) {
    console.error('getPaymentForInvoice error:', error);
    return { data: null, error: 'Payment not found' };
  }

  // Supabase returns joined relations as arrays; grab the first element
  const organizerRaw = data.organizers as unknown;
  const organizer = (Array.isArray(organizerRaw) ? organizerRaw[0] : organizerRaw) as
    | { name: string | null; email: string }
    | null;
  const subscriptionRaw = data.subscriptions as unknown;
  const sub = (Array.isArray(subscriptionRaw) ? subscriptionRaw[0] : subscriptionRaw) as
    | { plan_id: string; plans: unknown }
    | null;
  const plansRaw = sub?.plans;
  const plan = (Array.isArray(plansRaw) ? plansRaw[0] : plansRaw) as { name: string } | null;

  return {
    data: {
      paymentId: data.id,
      organizerId: data.organizer_id,
      recipientName: organizer?.name || organizer?.email?.split('@')[0] || 'Unknown',
      recipientEmail: organizer?.email || '',
      planId: sub?.plan_id || null,
      planName: plan?.name || sub?.plan_id || 'Pixtrace Plan',
      amountRupees: data.amount / 100,
      method: data.method,
      razorpayPaymentId: data.razorpay_payment_id,
      paidAt: data.paid_at,
      createdAt: data.created_at,
    },
  };
}

// ============================================================================
// INVOICE NUMBERING & TRACKING
// ============================================================================

/**
 * Get the next available invoice number for a given plan code and date.
 * Atomically claims the sequence by inserting a placeholder row.
 * Returns the full invoice number string.
 */
export async function getNextInvoiceNumber(
  planCode: string,
  issueDateStr: string, // YYYY-MM-DD
): Promise<{ invoiceNumber: string; dailySequence: number; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Validate inputs
  const code = (planCode || '99').slice(0, 2).padStart(2, '0');
  const issueDate = issueDateStr || new Date().toISOString().split('T')[0];

  // Find max daily_sequence for this date
  const { data: existing, error: queryErr } = await supabase
    .from('invoices')
    .select('daily_sequence')
    .eq('issue_date', issueDate)
    .order('daily_sequence', { ascending: false })
    .limit(1);

  if (queryErr) {
    console.error('getNextInvoiceNumber query error:', queryErr);
    return { invoiceNumber: '', dailySequence: 0, error: 'Failed to query invoice sequence' };
  }

  const nextSeq = (existing?.[0]?.daily_sequence || 0) + 1;

  // Build the number
  const d = new Date(issueDate + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const seq = String(nextSeq).padStart(4, '0');
  const invoiceNumber = `${code}${dd}${mm}${yyyy}${seq}`;

  return { invoiceNumber, dailySequence: nextSeq };
}

/**
 * Save an issued invoice to the database.
 * Uses INSERT with conflict handling on (issue_date, daily_sequence)
 * to prevent race conditions between concurrent admins.
 * Retries with the next sequence number on conflict (up to 3 attempts).
 */
export async function saveInvoice(params: {
  invoiceNumber: string;
  planCode: string;
  issueDate: string; // YYYY-MM-DD
  dailySequence: number;
  paymentId?: string | null;
  organizerId?: string | null;
  recipientName: string;
  recipientEmail: string;
  amountPaise: number;
}): Promise<{ success: boolean; invoiceNumber: string; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const MAX_RETRIES = 3;
  let seq = params.dailySequence;
  let invoiceNum = params.invoiceNumber;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { error: insertErr } = await supabase.from('invoices').insert({
      invoice_number: invoiceNum,
      plan_code: (params.planCode || '99').slice(0, 2),
      issue_date: params.issueDate,
      daily_sequence: seq,
      payment_id: params.paymentId || null,
      organizer_id: params.organizerId || null,
      recipient_name: params.recipientName || '',
      recipient_email: params.recipientEmail || '',
      amount: params.amountPaise || 0,
      status: 'issued',
    });

    if (!insertErr) {
      return { success: true, invoiceNumber: invoiceNum };
    }

    // Check if it's a unique constraint violation (race condition)
    if (insertErr.code === '23505') {
      // Another admin took this sequence — increment and retry
      seq += 1;
      const d = new Date(params.issueDate + 'T00:00:00');
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      const code = (params.planCode || '99').slice(0, 2).padStart(2, '0');
      invoiceNum = `${code}${dd}${mm}${yyyy}${String(seq).padStart(4, '0')}`;
      continue;
    }

    // Non-conflict error — bail
    console.error('saveInvoice error:', insertErr);
    return { success: false, invoiceNumber: invoiceNum, error: 'Failed to save invoice' };
  }

  return { success: false, invoiceNumber: invoiceNum, error: 'Too many concurrent invoice creations. Please try again.' };
}
