import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteR2WithTracking } from '@/lib/storage/r2-cleanup';
import { sendEmail } from '@/lib/email/resend';
import { storageWarningSubject, storageWarningHtml } from '@/lib/email/templates/storage-warning';
import { storageDeletedSubject, storageDeletedHtml } from '@/lib/email/templates/storage-deleted';

/**
 * GET|POST /api/cron/storage-cleanup
 *
 * Runs daily via Vercel Cron (GET) or external cron (POST). Two phases:
 *   Phase 1: Send warning emails to organizers whose grace period expires within 1 day
 *   Phase 2: Delete oldest events for organizers whose grace period has expired
 *
 * Protected by CRON_SECRET (Bearer token in Authorization header).
 */
export const GET = handler;
export const POST = handler;

async function handler(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[StorageCleanup] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // ── Phase 1: Send 1-day-before warning emails ─────────────────────────
  const warningsSent = await sendWarningEmails(supabase);

  // ── Phase 2: Delete expired grace periods ─────────────────────────────
  const { organizersProcessed, eventsDeleted, errors } = await deleteExpiredContent(supabase);

  console.log(
    `[StorageCleanup] Done. Warnings sent: ${warningsSent}, organizers cleaned: ${organizersProcessed}, events deleted: ${eventsDeleted}`,
  );

  return NextResponse.json({
    warningsSent,
    organizersProcessed,
    eventsDeleted,
    ...(errors.length > 0 && { errors }),
  });
}

type SupabaseClient = ReturnType<typeof createAdminClient>;

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: Warning emails (1 day before deletion)
// ═══════════════════════════════════════════════════════════════════════════

async function sendWarningEmails(supabase: SupabaseClient): Promise<number> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find organizers whose deadline is within 24 hours AND haven't been warned yet
  const { data: organizers } = await supabase
    .from('organizers')
    .select('id, email, name, plan_id, storage_used_bytes, custom_storage_limit_bytes, storage_grace_deadline, storage_deletion_warned_at')
    .not('storage_grace_deadline', 'is', null)
    .lte('storage_grace_deadline', tomorrow.toISOString())
    .gt('storage_grace_deadline', new Date().toISOString())
    .is('storage_deletion_warned_at', null);

  if (!organizers || organizers.length === 0) return 0;

  let sent = 0;

  for (const org of organizers) {
    try {
      // Fresh re-read to prevent race conditions
      const { data: fresh } = await supabase
        .from('organizers')
        .select('plan_id, storage_used_bytes, custom_storage_limit_bytes, storage_grace_deadline, storage_deletion_warned_at')
        .eq('id', org.id)
        .single();

      if (!fresh || !fresh.storage_grace_deadline || fresh.storage_deletion_warned_at) continue;

      // Resolve effective limit
      const { data: plan } = await supabase
        .from('plans')
        .select('storage_limit_bytes, name')
        .eq('id', fresh.plan_id)
        .single();

      const effectiveLimit = fresh.custom_storage_limit_bytes ?? plan?.storage_limit_bytes ?? 1073741824;
      if (effectiveLimit === 0) continue; // Unlimited — skip

      const storageUsed = fresh.storage_used_bytes ?? 0;

      // If user resolved overage since batch query, clear deadline instead
      if (storageUsed <= effectiveLimit) {
        await clearGraceDeadline(supabase, org.id);
        continue;
      }

      const deadlineDate = new Date(fresh.storage_grace_deadline).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });

      const emailSent = await sendEmail({
        to: org.email,
        subject: storageWarningSubject(),
        html: storageWarningHtml({
          name: org.name,
          usedDisplay: formatBytes(storageUsed),
          limitDisplay: formatBytes(effectiveLimit),
          overByDisplay: formatBytes(storageUsed - effectiveLimit),
          deadlineDate,
          planName: plan?.name || 'Free',
        }),
        emailType: 'storage_warning',
      });

      // Only mark as warned if email was actually sent — if it failed, retry next cron run
      if (emailSent) {
        await supabase
          .from('organizers')
          .update({ storage_deletion_warned_at: new Date().toISOString() })
          .eq('id', org.id);
        sent++;
      }
    } catch (err) {
      console.error(`[StorageCleanup] Warning email failed for ${org.id}:`, err);
    }
  }

  return sent;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: Delete expired content
// ═══════════════════════════════════════════════════════════════════════════

interface OrganizerRow {
  id: string;
  email: string;
  name: string | null;
  storage_used_bytes: number;
  custom_storage_limit_bytes: number | null;
  plan_id: string;
}

async function deleteExpiredContent(supabase: SupabaseClient) {
  const { data: overageOrganizers, error: fetchErr } = await supabase
    .from('organizers')
    .select('id, email, name, storage_used_bytes, custom_storage_limit_bytes, plan_id')
    .not('storage_grace_deadline', 'is', null)
    .lt('storage_grace_deadline', new Date().toISOString());

  if (fetchErr) {
    console.error('[StorageCleanup] Failed to fetch overage organizers:', fetchErr);
    return { organizersProcessed: 0, eventsDeleted: 0, errors: [fetchErr.message] };
  }

  if (!overageOrganizers || overageOrganizers.length === 0) {
    return { organizersProcessed: 0, eventsDeleted: 0, errors: [] as string[] };
  }

  let totalEventsDeleted = 0;
  const errors: string[] = [];

  for (const org of overageOrganizers) {
    try {
      const { eventsDeleted, bytesFreed, currentUsage, effectiveLimit, planName } =
        await cleanupOrganizerStorage(supabase, org);
      totalEventsDeleted += eventsDeleted;

      // Send post-deletion confirmation email
      if (eventsDeleted > 0) {
        await sendEmail({
          to: org.email,
          subject: storageDeletedSubject(eventsDeleted),
          html: storageDeletedHtml({
            name: org.name,
            eventsDeleted,
            bytesFreedDisplay: formatBytes(bytesFreed),
            currentUsageDisplay: formatBytes(currentUsage),
            limitDisplay: formatBytes(effectiveLimit),
            planName,
          }),
          emailType: 'storage_deleted',
        }).catch((err) => {
          console.error(`[StorageCleanup] Post-deletion email failed for ${org.id}:`, err);
        });
      }
    } catch (err) {
      const msg = `Organizer ${org.id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[StorageCleanup] ${msg}`);
      errors.push(msg);
    }
  }

  return { organizersProcessed: overageOrganizers.length, eventsDeleted: totalEventsDeleted, errors };
}

interface CleanupResult {
  eventsDeleted: number;
  bytesFreed: number;
  currentUsage: number;
  effectiveLimit: number;
  planName: string;
}

async function cleanupOrganizerStorage(
  supabase: SupabaseClient,
  org: OrganizerRow,
): Promise<CleanupResult> {
  const empty = { eventsDeleted: 0, bytesFreed: 0, currentUsage: 0, effectiveLimit: 0, planName: 'Free' };

  // ── CRITICAL: Re-fetch FRESH state before any destructive action ──────
  const { data: freshOrg } = await supabase
    .from('organizers')
    .select('plan_id, storage_used_bytes, custom_storage_limit_bytes, storage_grace_deadline')
    .eq('id', org.id)
    .single();

  if (!freshOrg) return empty;

  if (!freshOrg.storage_grace_deadline) return empty;

  if (new Date(freshOrg.storage_grace_deadline) > new Date()) return empty;

  // Resolve effective storage limit using FRESH plan_id
  const { data: plan } = await supabase
    .from('plans')
    .select('storage_limit_bytes, name')
    .eq('id', freshOrg.plan_id)
    .single();

  const effectiveLimit =
    freshOrg.custom_storage_limit_bytes ?? plan?.storage_limit_bytes ?? 1073741824;
  const planName = plan?.name || 'Free';

  // Safety: never cleanup unlimited plans (enterprise)
  if (effectiveLimit === 0) {
    await clearGraceDeadline(supabase, org.id);
    return { ...empty, effectiveLimit, planName };
  }

  let currentUsage = freshOrg.storage_used_bytes ?? 0;
  const startUsage = currentUsage;

  // Already under limit (user upgraded or deleted content since batch query)
  if (currentUsage <= effectiveLimit) {
    await clearGraceDeadline(supabase, org.id);
    return { ...empty, currentUsage, effectiveLimit, planName };
  }

  // Fetch events oldest-first
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .eq('organizer_id', org.id)
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) {
    await clearGraceDeadline(supabase, org.id);
    return { ...empty, currentUsage, effectiveLimit, planName };
  }

  let eventsDeleted = 0;

  for (const event of events) {
    if (currentUsage <= effectiveLimit) break;

    // 1. Fetch media sizes + R2 keys BEFORE delete (cascade removes rows)
    const { data: mediaRows } = await supabase
      .from('media')
      .select('r2_key, thumbnail_r2_key, preview_r2_key, file_size, variant_size_bytes')
      .eq('event_id', event.id);

    const eventBytes = (mediaRows || []).reduce(
      (sum, row) => sum + (row.file_size || 0) + (row.variant_size_bytes || 0),
      0,
    );

    // 2. Delete event (cascades to albums → media)
    const { error: deleteErr } = await supabase
      .from('events')
      .delete()
      .eq('id', event.id)
      .eq('organizer_id', org.id);

    if (deleteErr) {
      console.error(`[StorageCleanup] Failed to delete event ${event.id}:`, deleteErr);
      continue;
    }

    // 3. Decrement storage atomically
    if (eventBytes > 0) {
      await supabase.rpc('increment_storage_used', {
        org_id: org.id,
        bytes_to_add: -eventBytes,
      });
      currentUsage -= eventBytes;
    }

    // 4. Fire-and-forget R2 cleanup
    if (mediaRows && mediaRows.length > 0) {
      const r2Keys: string[] = [];
      for (const row of mediaRows) {
        if (row.r2_key) r2Keys.push(row.r2_key);
        if (row.thumbnail_r2_key) r2Keys.push(row.thumbnail_r2_key);
        if (row.preview_r2_key) r2Keys.push(row.preview_r2_key);
      }
      if (r2Keys.length > 0) {
        deleteR2WithTracking(r2Keys, 'storage_cleanup');
      }
    }

    eventsDeleted++;
    console.log(
      `[StorageCleanup] Deleted event ${event.id} for organizer ${org.id} (freed ${(eventBytes / 1024 / 1024).toFixed(1)} MB)`,
    );
  }

  // Clear grace deadline after cleanup
  await clearGraceDeadline(supabase, org.id);

  return {
    eventsDeleted,
    bytesFreed: startUsage - currentUsage,
    currentUsage,
    effectiveLimit,
    planName,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function clearGraceDeadline(supabase: SupabaseClient, organizerId: string) {
  await supabase
    .from('organizers')
    .update({
      storage_grace_deadline: null,
      storage_grace_notified_at: null,
      storage_deletion_warned_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizerId);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
