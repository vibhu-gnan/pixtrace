import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FACE_SEARCH } from '@/lib/face/constants';
import { runRecallSearch } from '@/lib/face/recall-search';
import { getThumbnailUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { eventHash } = await request.json();

    if (!eventHash) {
      return NextResponse.json({ error: 'Missing eventHash' }, { status: 400 });
    }

    // Verify auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const token = authHeader.slice(7);
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Resolve event
    const { data: eventData } = await adminClient
      .from('events')
      .select('id, face_search_enabled')
      .eq('event_hash', eventHash)
      .eq('is_public', true)
      .single();

    if (!eventData) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Look up gallery_user + profile
    const { data: galleryUser } = await adminClient
      .from('gallery_users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!galleryUser) {
      return NextResponse.json({ has_profile: false });
    }

    const { data: profile } = await adminClient
      .from('face_search_profiles')
      .select('prototype_embedding, match_count')
      .eq('gallery_user_id', galleryUser.id)
      .eq('event_id', eventData.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ has_profile: false });
    }

    // Parse stored prototype
    let prototype: number[];
    const raw = profile.prototype_embedding;
    if (Array.isArray(raw)) {
      prototype = raw;
    } else if (typeof raw === 'string') {
      prototype = JSON.parse(raw);
    } else {
      return NextResponse.json({ has_profile: false });
    }

    // Run recall search (single pass, no refinement)
    const { tier1, tier2 } = await runRecallSearch(adminClient, prototype, eventData.id);

    const allMatches = [...tier1, ...tier2];
    if (allMatches.length === 0) {
      return NextResponse.json({
        has_profile: true,
        tier1: [],
        tier2: [],
        total_matches: 0,
        search_time_ms: Date.now() - startTime,
      });
    }

    // Fetch media details
    const mediaIds = allMatches.map(m => m.mediaId);
    const { data: mediaItems } = await adminClient
      .from('media')
      .select('id, album_id, r2_key, preview_r2_key, width, height')
      .in('id', mediaIds);

    if (!mediaItems) {
      return NextResponse.json({
        has_profile: true,
        tier1: [],
        tier2: [],
        total_matches: 0,
        search_time_ms: Date.now() - startTime,
      });
    }

    const mediaMap = new Map(mediaItems.map(m => [m.id, m]));

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

    const tier1Results = tier1.filter(m => m.score >= FACE_SEARCH.DISPLAY_THRESHOLD).map(buildResult).filter(Boolean);
    const tier2Results = tier2.filter(m => m.score >= FACE_SEARCH.DISPLAY_THRESHOLD).map(buildResult).filter(Boolean);

    return NextResponse.json({
      has_profile: true,
      tier1: tier1Results,
      tier2: tier2Results,
      total_matches: tier1Results.length + tier2Results.length,
      search_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Recall search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
