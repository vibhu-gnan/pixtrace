import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySecret } from '@/lib/security/verify-secret';
import { purgeExpiredTakedowns } from '@/actions/takedowns';
import { sendTakedownRequestEmail } from '@/lib/email/send-takedown-email';
import { captureError } from '@/lib/monitoring/sentry';

/**
 * GET|POST /api/cron/takedown-maintenance
 *
 * Housekeeping for photo takedowns. Note what is deliberately absent: restoring photos
 * after the 6-hour window. That is encoded in `media.takedown_hidden_until`, so a photo
 * reappears the moment the timestamp passes whether or not this job ever runs.
 *
 * Three jobs, none of which is on a user-facing critical path:
 *   1. Retire pending requests whose window has elapsed, so the photo can be requested
 *      again later.
 *   2. Retry notifications that never sent (sendEmail returns false rather than throwing,
 *      and the request is only stamped once it succeeds).
 *   3. Hard-delete approved photos past their 30-day grace period.
 *
 * Protected by CRON_SECRET (Bearer token in Authorization header).
 */
export const GET = handler;
export const POST = handler;

async function handler(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    captureError(new Error('CRON_SECRET not configured'), {
      source: 'takedown-maintenance',
      level: 'fatal',
    });
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!verifySecret(bearerToken, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // ── 1. Retire elapsed requests ───────────────────────────────────────
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
    captureError(err as Error, { source: 'takedown-maintenance', extra: { phase: 'expire' } });
  }

  // ── 2. Retry notifications that never went out ───────────────────────
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
    captureError(err as Error, { source: 'takedown-maintenance', extra: { phase: 'notify' } });
  }

  // ── 3. Hard-delete anything past its grace period ────────────────────
  let purged = 0;
  try {
    ({ purged } = await purgeExpiredTakedowns());
  } catch (err) {
    captureError(err as Error, { source: 'takedown-maintenance', extra: { phase: 'purge' } });
  }

  return NextResponse.json({ expired, notified, purged });
}
