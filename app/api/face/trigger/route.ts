import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FACE_SEARCH } from '@/lib/face/constants';
import { getR2PublicUrl } from '@/lib/storage/r2-client';

export async function POST(request: NextRequest) {
  // Verify shared secret
  const secret = request.headers.get('X-Face-Secret') || '';
  if (secret !== process.env.FACE_PROCESSING_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Atomically claim pending jobs (unsticks crashed ones + increments attempt_count)
  const { data: claimedJobs, error: claimErr } = await supabase.rpc(
    'claim_face_processing_jobs',
    {
      max_jobs: FACE_SEARCH.MAX_BATCH_SIZE,
      stuck_timeout_minutes: FACE_SEARCH.STUCK_JOB_TIMEOUT_MINUTES,
    },
  );

  if (claimErr || !claimedJobs || claimedJobs.length === 0) {
    return NextResponse.json({ dispatched: 0 });
  }

  // Get R2 URLs for the claimed media items
  const mediaIds = claimedJobs.map((j: any) => j.media_id);
  const { data: mediaItems } = await supabase
    .from('media')
    .select('id, r2_key, event_id')
    .in('id', mediaIds);

  if (!mediaItems || mediaItems.length === 0) {
    return NextResponse.json({ dispatched: 0, error: 'no media found' });
  }

  // Group by event_id for batched Modal calls
  const batches = new Map<string, { media_id: string; r2_url: string }[]>();
  for (const item of mediaItems) {
    const r2Url = getR2PublicUrl(item.r2_key);
    const eventId = item.event_id;
    if (!batches.has(eventId)) batches.set(eventId, []);
    batches.get(eventId)!.push({ media_id: item.id, r2_url: r2Url });
  }

  const modalUrl = process.env.MODAL_ENDPOINT_URL;
  if (!modalUrl) {
    console.error('MODAL_ENDPOINT_URL not set');
    return NextResponse.json({ error: 'GPU server not configured' }, { status: 503 });
  }

  let totalDispatched = 0;
  const errors: string[] = [];

  for (const [eventId, items] of batches) {
    try {
      const resp = await fetch(`${modalUrl}/process-gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          media_items: items,
          secret: process.env.FACE_PROCESSING_SECRET,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'unknown');
        errors.push(`Modal error for event ${eventId}: ${resp.status} ${errText}`);

        // Reset jobs to failed with backoff
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
      errors.push(`Fetch error for event ${eventId}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    dispatched: totalDispatched,
    total_jobs: claimedJobs.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
