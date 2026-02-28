import { NextRequest, NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/supabase/public';
import { getSignedR2Url, R2ConfigError } from '@/lib/storage/r2-client';

/**
 * POST /api/gallery/refresh-urls
 *
 * Batch-refresh presigned URLs for public gallery images whose URLs have expired.
 * Called by the client when images fail to load (likely after 4-hour URL expiry).
 *
 * Security:
 * - Only works for media belonging to public events (verified via DB)
 * - Accepts media IDs (not raw r2Keys) to prevent arbitrary bucket access
 * - Max 50 media items per request to prevent abuse
 * - No auth required (gallery is public) but scoped to verified media only
 */

const MAX_BATCH_SIZE = 50;

interface RefreshRequest {
  eventHash: string;
  mediaIds: string[];
}

interface RefreshedUrls {
  thumbnail: string;
  preview: string;
  original: string;
}

export async function POST(request: NextRequest) {
  let body: RefreshRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { eventHash, mediaIds } = body;

  if (!eventHash || typeof eventHash !== 'string') {
    return NextResponse.json({ error: 'Missing eventHash' }, { status: 400 });
  }

  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    return NextResponse.json({ error: 'Missing or empty mediaIds array' }, { status: 400 });
  }

  if (mediaIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Max ${MAX_BATCH_SIZE} media IDs per request` },
      { status: 400 }
    );
  }

  // Validate all IDs are strings (prevent injection)
  if (mediaIds.some(id => typeof id !== 'string' || id.length > 64)) {
    return NextResponse.json({ error: 'Invalid media ID format' }, { status: 400 });
  }

  try {
    const supabase = getPublicClient();

    // 1. Verify event is public (RLS enforces this too, but explicit check for clarity)
    type EventRow = { id: string };
    const { data: event } = await (supabase
      .from('events')
      .select('id')
      .eq('event_hash', eventHash)
      .eq('is_public', true)
      .single() as unknown as Promise<{ data: EventRow | null; error: unknown }>);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 2. Fetch media rows — only for this event (prevents cross-event leakage)
    type MediaRow = {
      id: string;
      r2_key: string;
      thumbnail_r2_key: string | null;
      preview_r2_key: string | null;
    };

    const { data: mediaRows } = await (supabase
      .from('media')
      .select('id, r2_key, thumbnail_r2_key, preview_r2_key')
      .in('id', mediaIds)
      .eq('event_id', event.id) as unknown as Promise<{ data: MediaRow[] | null; error: unknown }>);

    if (!mediaRows || mediaRows.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    // 3. Generate fresh presigned URLs in parallel
    const urlEntries = await Promise.all(
      mediaRows.map(async (row): Promise<[string, RefreshedUrls]> => {
        const [thumbnail, preview, original] = await Promise.all([
          safeSign(row.thumbnail_r2_key || row.preview_r2_key || row.r2_key),
          safeSign(row.preview_r2_key || row.r2_key),
          safeSign(row.r2_key),
        ]);

        return [row.id, { thumbnail, preview, original }];
      })
    );

    const urls: Record<string, RefreshedUrls> = Object.fromEntries(urlEntries);

    return NextResponse.json({ urls }, {
      headers: {
        // Cache for 3 hours (URLs are valid for 4, gives 1hr buffer)
        'Cache-Control': 'private, max-age=10800',
      },
    });
  } catch (err) {
    if (err instanceof R2ConfigError) {
      console.error('[refresh-urls] R2 not configured:', err.message);
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    console.error('[refresh-urls] Error refreshing URLs:', err);
    return NextResponse.json({ error: 'Failed to refresh URLs' }, { status: 500 });
  }
}

/** Sign a URL, returning '' on failure (never throws) */
async function safeSign(key: string | null | undefined): Promise<string> {
  if (!key) return '';
  try {
    return await getSignedR2Url(key);
  } catch {
    return '';
  }
}
