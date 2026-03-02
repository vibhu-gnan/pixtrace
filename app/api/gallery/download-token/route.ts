import { NextRequest, NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/supabase/public';
import { createDownloadToken } from '@/lib/storage/download-token';

/**
 * POST /api/gallery/download-token
 *
 * Generate a time-limited, HMAC-signed download token for a public gallery photo.
 * No login required — but the media must belong to a public event with downloads enabled.
 *
 * Security:
 * - Accepts media ID (not raw r2Key) to prevent arbitrary bucket access
 * - Verifies event is public AND allow_download is true
 * - Token is HMAC-signed and expires in 4 hours
 * - One token per request to prevent bulk token farming
 */

export async function POST(request: NextRequest) {
  let body: { eventHash: string; mediaId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { eventHash, mediaId } = body;

  if (!eventHash || typeof eventHash !== 'string') {
    return NextResponse.json({ error: 'Missing eventHash' }, { status: 400 });
  }
  if (!mediaId || typeof mediaId !== 'string' || mediaId.length > 64) {
    return NextResponse.json({ error: 'Missing or invalid mediaId' }, { status: 400 });
  }

  try {
    const supabase = getPublicClient();

    // Verify event is public AND downloads are allowed
    type EventRow = { id: string; allow_download: boolean };
    const { data: event } = await (supabase
      .from('events')
      .select('id, allow_download')
      .eq('event_hash', eventHash)
      .eq('is_public', true)
      .single() as unknown as Promise<{ data: EventRow | null; error: unknown }>);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.allow_download) {
      return NextResponse.json({ error: 'Downloads are not enabled for this event' }, { status: 403 });
    }

    // Verify media belongs to this event
    type MediaRow = { id: string; r2_key: string; original_filename: string };
    const { data: media } = await (supabase
      .from('media')
      .select('id, r2_key, original_filename')
      .eq('id', mediaId)
      .eq('event_id', event.id)
      .single() as unknown as Promise<{ data: MediaRow | null; error: unknown }>);

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Generate signed token (4-hour TTL)
    const token = createDownloadToken(media.r2_key);

    return NextResponse.json({
      token,
      filename: media.original_filename,
    });
  } catch (err) {
    console.error('[download-token] Error:', err);
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
  }
}
