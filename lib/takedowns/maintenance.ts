import { createAdminClient } from '@/lib/supabase/admin';
import { deleteR2WithTracking } from '@/lib/storage/r2-cleanup';
import { decrementStorageUsed } from '@/lib/plans/limits';
import { sendTakedownRequestEmail } from '@/lib/email/send-takedown-email';
import type { SupabaseClient } from '@supabase/supabase-js';

// Deliberately NOT under actions/ and deliberately without 'use server': every export of
// a 'use server' module becomes a POST endpoint that anyone on the internet can call.
// These two delete media and send email and carry no caller-level auth of their own, so
// they must stay reachable only from the cron routes, which verify CRON_SECRET.

/**
 * Hard-delete everything whose grace period has elapsed. Called by the cron; mirrors
 * `deleteMedia` in actions/media.ts — cascades clear face_embeddings and
 * face_processing_jobs, storage is credited back, and R2 failures are tracked for retry.
 */
export async function purgeExpiredTakedowns(): Promise<{ purged: number }> {
  const supabase = createAdminClient();

  const { data: due } = await supabase
    .from('media')
    .select('id, event_id, r2_key, thumbnail_r2_key, preview_r2_key, file_size, variant_size_bytes, events!inner(organizer_id)')
    .not('takedown_purge_at', 'is', null)
    .lt('takedown_purge_at', new Date().toISOString())
    .limit(200);

  if (!due || due.length === 0) return { purged: 0 };

  let purged = 0;
  for (const row of due) {
    const media = row as unknown as {
      id: string; r2_key: string | null; thumbnail_r2_key: string | null;
      preview_r2_key: string | null; file_size: number | null; variant_size_bytes: number | null;
      events: { organizer_id: string };
    };

    const { error } = await supabase.from('media').delete().eq('id', media.id);
    if (error) {
      console.error('takedown purge: delete failed', media.id, error.message);
      continue;
    }
    purged++;

    const bytes = (media.file_size || 0) + (media.variant_size_bytes || 0);
    if (bytes > 0 && media.events?.organizer_id) {
      decrementStorageUsed(media.events.organizer_id, bytes).catch((err) => {
        console.error('takedown purge: storage decrement failed', err);
      });
    }

    const keys = [media.r2_key, media.thumbnail_r2_key, media.preview_r2_key].filter(
      (k): k is string => Boolean(k),
    );
    if (keys.length) deleteR2WithTracking(keys, 'media_delete');
  }

  return { purged };
}

/**
 * Periodic housekeeping, called from the daily cron.
 *
 * Note what is absent: restoring photos after the 6-hour window. That lives in
 * `media.takedown_hidden_until`, so a photo reappears the moment it passes whether or
 * not this ever runs. Only the parts that genuinely need a scheduler are here.
 */
export async function runTakedownMaintenance(): Promise<{
  expired: number;
  notified: number;
  purged: number;
}> {
  const supabase = createAdminClient() as SupabaseClient;
  const nowIso = new Date().toISOString();

  // Retire requests whose window elapsed, so the photo can be requested again later.
  let expired = 0;
  try {
    const { data } = await supabase
      .from('takedown_requests')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('auto_restore_at', nowIso)
      .select('id');
    expired = data?.length ?? 0;
  } catch (err) {
    console.error('takedown maintenance: expire failed', err);
  }

  // Retry notifications that never sent. sendEmail returns false rather than throwing,
  // and a request is stamped only on success, so these are exactly the ones missed.
  let notified = 0;
  try {
    const { data: unnotified } = await supabase
      .from('takedown_requests')
      .select('id, reason, requester_email, event_id, events!inner(name, event_hash), media!inner(original_filename)')
      .eq('status', 'pending')
      .is('notified_at', null)
      .limit(50);

    for (const row of unnotified ?? []) {
      const r = row as unknown as {
        id: string; reason: string | null; requester_email: string | null; event_id: string;
        events: { name: string; event_hash: string };
        media: { original_filename: string | null };
      };

      const sent = await sendTakedownRequestEmail({
        eventId: r.event_id,
        eventName: r.events.name,
        eventHash: r.events.event_hash,
        filename: r.media?.original_filename ?? null,
        reason: r.reason,
        requesterEmail: r.requester_email,
      });

      if (sent) {
        await supabase
          .from('takedown_requests')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', r.id);
        notified++;
      }
    }
  } catch (err) {
    console.error('takedown maintenance: notify retry failed', err);
  }

  let purged = 0;
  try {
    ({ purged } = await purgeExpiredTakedowns());
  } catch (err) {
    console.error('takedown maintenance: purge failed', err);
  }

  return { expired, notified, purged };
}
