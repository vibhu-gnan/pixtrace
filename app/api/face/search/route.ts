import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicClient } from '@/lib/supabase/public';
import { FACE_SEARCH } from '@/lib/face/constants';
import { runFaceSearch } from '@/lib/face/search-algorithm';
import { getThumbnailUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const selfie = formData.get('selfie') as File | null;
    const eventHash = formData.get('eventHash') as string | null;
    const albumId = formData.get('albumId') as string | null;

    if (!selfie || !eventHash) {
      return NextResponse.json(
        { error: 'Missing selfie or eventHash' },
        { status: 400 },
      );
    }

    // Validate selfie
    if (!selfie.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Selfie must be an image' },
        { status: 400 },
      );
    }
    if (selfie.size > FACE_SEARCH.MAX_SELFIE_SIZE) {
      return NextResponse.json(
        { error: 'Selfie too large (max 5MB)' },
        { status: 400 },
      );
    }

    // Resolve event_hash → event_id (must be public)
    const publicClient = getPublicClient();
    const { data: eventData } = await publicClient
      .from('events')
      .select('id, name, is_public')
      .eq('event_hash', eventHash)
      .eq('is_public', true)
      .single();

    const event = eventData as { id: string; name: string; is_public: boolean } | null;
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or not public' },
        { status: 404 },
      );
    }

    // Convert selfie to base64 and send to Modal for embedding
    const embedSelfieUrl = process.env.MODAL_EMBED_SELFIE_URL;
    if (!embedSelfieUrl) {
      return NextResponse.json(
        { error: 'Face search service not configured' },
        { status: 503 },
      );
    }

    const selfieBuffer = await selfie.arrayBuffer();
    const selfieBase64 = Buffer.from(selfieBuffer).toString('base64');

    const embedResp = await fetch(embedSelfieUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: selfieBase64,
        secret: process.env.FACE_PROCESSING_SECRET,
      }),
    });

    const embedResult = await embedResp.json().catch(() => null);

    if (!embedResp.ok || !embedResult) {
      console.error('Modal embed_selfie error:', embedResp.status, embedResult);
      return NextResponse.json(
        { error: 'Face processing service unavailable' },
        { status: 503 },
      );
    }

    // Handle all error responses from Modal
    if (embedResult.error) {
      const errorMap: Record<string, { error: string; message: string; status: number }> = {
        no_face_detected: { error: 'no_face_detected', message: 'No face detected in your selfie. Please try again with better lighting and face the camera directly.', status: 422 },
        invalid_image: { error: 'invalid_image', message: 'Could not process your photo. Please try taking a new selfie.', status: 422 },
        invalid_embedding: { error: 'low_quality_selfie', message: 'Could not generate a valid face embedding. Please try again with better lighting.', status: 422 },
        processing_failed: { error: 'processing_failed', message: 'Face processing failed. Please try again.', status: 500 },
      };
      const mapped = errorMap[embedResult.error] || { error: embedResult.error, message: embedResult.message || 'Unknown error', status: 500 };
      return NextResponse.json(
        { error: mapped.error, message: mapped.message },
        { status: mapped.status },
      );
    }

    if (embedResult.confidence < FACE_SEARCH.MIN_SELFIE_CONFIDENCE) {
      return NextResponse.json(
        { error: 'low_quality_selfie', confidence: embedResult.confidence, message: 'Face detection confidence is too low. Try better lighting.' },
        { status: 422 },
      );
    }

    const selfieEmbedding: number[] = embedResult.embedding;

    // Validate embedding for NaN/Inf
    if (!selfieEmbedding || selfieEmbedding.length !== 512 || selfieEmbedding.some((v: number) => !Number.isFinite(v))) {
      console.error('Invalid embedding from Modal:', {
        length: selfieEmbedding?.length,
        hasNaN: selfieEmbedding?.some((v: number) => Number.isNaN(v)),
        sample: selfieEmbedding?.slice(0, 5),
      });
      return NextResponse.json(
        { error: 'low_quality_selfie', message: 'Could not generate a valid face embedding. Please try again with better lighting.' },
        { status: 422 },
      );
    }

    // Run 3-iteration refinement search
    const adminClient = createAdminClient();
    const { tier1, tier2 } = await runFaceSearch(adminClient, selfieEmbedding, event.id);

    // Collect all matching media_ids
    const allMatches = [...tier1, ...tier2];
    if (allMatches.length === 0) {
      return NextResponse.json({
        tier1: [],
        tier2: [],
        total_matches: 0,
        search_time_ms: Date.now() - startTime,
      });
    }

    // Fetch media details
    const mediaIds = allMatches.map(m => m.mediaId);
    let mediaQuery = adminClient
      .from('media')
      .select('id, album_id, r2_key, preview_r2_key, width, height')
      .in('id', mediaIds);

    const { data: mediaItems } = await mediaQuery;

    if (!mediaItems) {
      return NextResponse.json({
        tier1: [],
        tier2: [],
        total_matches: 0,
        search_time_ms: Date.now() - startTime,
      });
    }

    // Apply album filter if provided
    const filteredMedia = albumId
      ? mediaItems.filter(m => m.album_id === albumId)
      : mediaItems;

    const mediaMap = new Map(filteredMedia.map(m => [m.id, m]));

    // Build response with URLs
    const buildResult = (match: typeof allMatches[0]) => {
      const m = mediaMap.get(match.mediaId);
      if (!m) return null;
      return {
        media_id: m.id,
        album_id: m.album_id,
        thumbnail_url: getThumbnailUrl(m.r2_key, 200, m.preview_r2_key),
        full_url: getPreviewUrl(m.r2_key, m.preview_r2_key),
        original_url: getOriginalUrl(m.r2_key),
        width: m.width,
        height: m.height,
        score: Math.round(match.score * 1000) / 1000,
        tier: match.tier,
      };
    };

    const tier1Results = tier1.map(buildResult).filter(Boolean);
    const tier2Results = tier2.map(buildResult).filter(Boolean);

    return NextResponse.json({
      tier1: tier1Results,
      tier2: tier2Results,
      total_matches: tier1Results.length + tier2Results.length,
      search_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Face search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
