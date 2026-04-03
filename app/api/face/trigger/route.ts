import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FACE_SEARCH } from '@/lib/face/constants';
import { getSignedR2Url } from '@/lib/storage/r2-client';
import crypto from 'crypto';

export const maxDuration = 60; // 1 min — trigger only dispatches; Modal updates Supabase directly

function verifyAuth(request: NextRequest): boolean {
  // Accept two auth methods:
  //   1. X-Face-Secret header — used by manual/external callers (POST)
  //   2. Authorization: Bearer <CRON_SECRET> — used by Vercel cron scheduler (GET)
  const faceSecret = request.headers.get('X-Face-Secret') || '';
  const authHeader = request.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const expectedFaceSecret = process.env.FACE_PROCESSING_SECRET || '';
  const expectedCronSecret = process.env.CRON_SECRET || '';

  const isValidFaceSecret =
    expectedFaceSecret &&
    faceSecret.length === expectedFaceSecret.length &&
    crypto.timingSafeEqual(Buffer.from(faceSecret), Buffer.from(expectedFaceSecret));

  const isValidCronSecret =
    expectedCronSecret &&
    bearerToken.length === expectedCronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(bearerToken), Buffer.from(expectedCronSecret));

  return !!(isValidFaceSecret || isValidCronSecret);
}

// GET — called by Vercel cron every 5 minutes
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runTrigger();
}

// POST — called manually or from external tools
export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return runTrigger();
}

async function runTrigger() {

  const processGalleryUrl = process.env.MODAL_PROCESS_GALLERY_URL;
  if (!processGalleryUrl) {
    console.error('MODAL_PROCESS_GALLERY_URL not set');
    return NextResponse.json({ error: 'GPU server not configured' }, { status: 503 });
  }

  const supabase = createAdminClient();

  let totalDispatched = 0;
  let totalClaimed = 0;
  const allErrors: string[] = [];

  // Loop: keep claiming + dispatching batches until no more pending jobs.
  // Max 20 rounds to prevent infinite loops (20 × 50 = 1000 photos max).
  for (let round = 0; round < 20; round++) {
    // Atomically claim pending jobs (unsticks crashed ones + increments attempt_count)
    const { data: claimedJobs, error: claimErr } = await supabase.rpc(
      'claim_face_processing_jobs',
      {
        max_jobs: FACE_SEARCH.MAX_BATCH_SIZE,
        stuck_timeout_minutes: FACE_SEARCH.STUCK_JOB_TIMEOUT_MINUTES,
      },
    );

    if (claimErr || !claimedJobs || claimedJobs.length === 0) {
      break; // No more jobs to process
    }

    totalClaimed += claimedJobs.length;

    // Get R2 URLs for the claimed media items
    const mediaIds = claimedJobs.map((j: any) => j.media_id);
    const { data: mediaItems } = await supabase
      .from('media')
      .select('id, r2_key, event_id')
      .in('id', mediaIds);

    if (!mediaItems || mediaItems.length === 0) {
      continue;
    }

    // Group by event_id for batched Modal calls
    const batches = new Map<string, { media_id: string; r2_url: string }[]>();
    for (const item of mediaItems) {
      const r2Url = await getSignedR2Url(item.r2_key);
      const eventId = item.event_id;
      if (!batches.has(eventId)) batches.set(eventId, []);
      batches.get(eventId)!.push({ media_id: item.id, r2_url: r2Url });
    }

    for (const [eventId, items] of batches) {
      try {
        // Fire-and-forget: Modal processes the batch and updates Supabase directly.
        // We use a short timeout just to confirm Modal accepted the request.
        // This avoids Cloudflare's 100s proxy timeout killing the trigger.
        const resp = await fetch(processGalleryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            media_items: items,
            secret: process.env.FACE_PROCESSING_SECRET,
          }),
          signal: AbortSignal.timeout(30_000), // 30s — just confirm Modal accepted
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => 'unknown');
          allErrors.push(`Modal error for event ${eventId}: ${resp.status} ${errText}`);

          // Reset jobs to failed with backoff so they retry next trigger
          const failedMediaIds = items.map(i => i.media_id);
          const retryAt = new Date(Date.now() + FACE_SEARCH.RETRY_BASE_DELAY_S * 1000).toISOString();
          await supabase
            .from('face_processing_jobs')
            .update({
              status: 'failed',
              error_message: `GPU server error: ${resp.status}`,
              next_retry_at: retryAt,
              updated_at: new Date().toISOString(),
            })
            .in('media_id', failedMediaIds);
        } else {
          totalDispatched += items.length;
        }
      } catch (err) {
        allErrors.push(`Fetch error for event ${eventId}: ${String(err)}`);

        // Reset jobs to failed so they can be retried next trigger
        const failedMediaIds = items.map(i => i.media_id);
        const retryAt = new Date(Date.now() + FACE_SEARCH.RETRY_BASE_DELAY_S * 1000).toISOString();
        await supabase
          .from('face_processing_jobs')
          .update({
            status: 'failed',
            error_message: `Trigger error: ${String(err)}`,
            next_retry_at: retryAt,
            updated_at: new Date().toISOString(),
          })
          .in('media_id', failedMediaIds);
      }
    }
  }

  return NextResponse.json({
    dispatched: totalDispatched,
    total_claimed: totalClaimed,
    errors: allErrors.length > 0 ? allErrors : undefined,
  });
}

