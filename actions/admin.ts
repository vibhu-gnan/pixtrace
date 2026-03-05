'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const users = (data || []).map((u: any) => ({
    ...u,
    event_count: u.events?.length || 0,
    events: undefined, // don't leak full event list
  }));

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

  return {
    user,
    events: eventsWithCounts,
    subscriptions: subscriptions || [],
    payments: payments || [],
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

  const validPlans = ['free', 'starter', 'pro', 'enterprise'];
  if (!validPlans.includes(newPlanId)) {
    return { error: 'Invalid plan' };
  }

  const { error } = await supabase
    .from('organizers')
    .update({ plan_id: newPlanId, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('changeUserPlan error:', error);
    return { error: 'Failed to update plan' };
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
