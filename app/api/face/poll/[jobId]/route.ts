import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FACE_SEARCH } from '@/lib/face/constants';
import { getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

// Max time to wait before treating a job as stuck (matches Modal cron timeout budget)
const STUCK_PENDING_MINUTES = 10;
const STUCK_PROCESSING_MINUTES = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: job, error } = await adminClient
      .from('face_search_jobs')
      .select('id, status, result, error, created_at, started_at, completed_at, event_id, album_id')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const now = Date.now();

    // Detect stuck jobs and fail them so the client doesn't poll forever
    if (job.status === 'pending') {
      const ageMs = now - new Date(job.created_at).getTime();
      if (ageMs > STUCK_PENDING_MINUTES * 60 * 1000) {
        await adminClient
          .from('face_search_jobs')
          .update({ status: 'failed', error: 'Job timed out waiting to be picked up' })
          .eq('id', jobId)
          .eq('status', 'pending');
        return NextResponse.json({
          status: 'failed',
          error: 'Face search timed out. Please try again.',
        });
      }
      return NextResponse.json({ status: 'pending' });
    }

    if (job.status === 'processing') {
      const ageMs = now - new Date(job.started_at).getTime();
      if (ageMs > STUCK_PROCESSING_MINUTES * 60 * 1000) {
        await adminClient
          .from('face_search_jobs')
          .update({ status: 'failed', error: 'Job stuck in processing' })
          .eq('id', jobId)
          .eq('status', 'processing');
        return NextResponse.json({
          status: 'failed',
          error: 'Face search timed out during processing. Please try again.',
        });
      }
      return NextResponse.json({ status: 'processing' });
    }

    if (job.status === 'failed') {
      const knownErrors: Record<string, string> = {
        no_face_detected: 'No face detected in your selfie. Please try again with better lighting and face the camera directly.',
        invalid_embedding: 'Could not generate a valid face embedding. Please try again with better lighting.',
        low_quality_selfie: 'Face detection confidence too low. Try better lighting.',
      };
      const errorKey = job.error || 'unknown';
      const message = knownErrors[errorKey] || 'Face search failed. Please try again.';
      return NextResponse.json({ status: 'failed', error: errorKey, message });
    }

    // status === 'completed' — build full result with signed URLs
    const result = job.result as { tier1: { media_id: string; score: number }[]; tier2: { media_id: string; score: number }[] } | null;
    if (!result) {
      return NextResponse.json({ status: 'completed', tier1: [], tier2: [], total_matches: 0 });
    }

    const allMatches = [...(result.tier1 || []), ...(result.tier2 || [])];
    if (allMatches.length === 0) {
      return NextResponse.json({ status: 'completed', tier1: [], tier2: [], total_matches: 0 });
    }

    // Fetch media details; filter by album_id if the job had one
    const mediaIds = allMatches.map(m => m.media_id);
    let mediaQuery = adminClient
      .from('media')
      .select('id, album_id, r2_key, preview_r2_key, width, height')
      .in('id', mediaIds);

    if (job.album_id) {
      mediaQuery = mediaQuery.eq('album_id', job.album_id);
    }

    const { data: mediaItems } = await mediaQuery;
    if (!mediaItems || mediaItems.length === 0) {
      return NextResponse.json({ status: 'completed', tier1: [], tier2: [], total_matches: 0 });
    }

    const mediaMap = new Map(mediaItems.map(m => [m.id, m]));

    const buildResult = async (match: { media_id: string; score: number }, tier: 1 | 2) => {
      if (match.score < FACE_SEARCH.DISPLAY_THRESHOLD) return null;
      const m = mediaMap.get(match.media_id);
      if (!m) return null;
      return {
        media_id: m.id,
        album_id: m.album_id,
        r2_key: m.r2_key,
        preview_url: await getPreviewUrl(m.r2_key, m.preview_r2_key),
        original_url: await getOriginalUrl(m.r2_key),
        width: m.width,
        height: m.height,
        score: match.score,
        tier,
      };
    };

    const [tier1Results, tier2Results] = await Promise.all([
      Promise.all((result.tier1 || []).map(m => buildResult(m, 1))),
      Promise.all((result.tier2 || []).map(m => buildResult(m, 2))),
    ]);

    const tier1 = tier1Results.filter(Boolean);
    const tier2 = tier2Results.filter(Boolean);

    return NextResponse.json({
      status: 'completed',
      tier1,
      tier2,
      total_matches: tier1.length + tier2.length,
    });
  } catch (error) {
    console.error('Face poll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
