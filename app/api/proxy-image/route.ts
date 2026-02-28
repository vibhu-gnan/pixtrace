import { NextRequest, NextResponse } from 'next/server';
import { getR2Object, R2ConfigError, R2AccessError } from '@/lib/storage/r2-client';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_PROXY_SIZE = 25 * 1024 * 1024; // 25MB max

export async function GET(request: NextRequest) {
  const r2Key = request.nextUrl.searchParams.get('r2Key');
  if (!r2Key) {
    return NextResponse.json({ error: 'Missing r2Key parameter' }, { status: 400 });
  }

  // Basic path-traversal prevention
  if (r2Key.includes('..') || r2Key.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  try {
    const { body, contentType } = await getR2Object(r2Key);

    if (body.byteLength > MAX_PROXY_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const safeContentType = ALLOWED_CONTENT_TYPES.find(t => contentType.startsWith(t)) || 'image/jpeg';

    return new NextResponse(Buffer.from(body), {
      headers: {
        'Content-Type': safeContentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': body.byteLength.toString(),
      },
    });
  } catch (err) {
    // ── Classified error responses ──
    if (err instanceof R2ConfigError) {
      console.error('[proxy-image] R2 not configured:', err.message);
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    if (err instanceof R2AccessError) {
      if (err.statusCode === 403) {
        console.error('[proxy-image] R2 access denied:', err.message);
        return NextResponse.json({ error: 'Storage access denied' }, { status: 502 });
      }
      if (err.statusCode === 404) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 });
      }
      // 5xx from R2 → surface as 502 (upstream error)
      console.error('[proxy-image] R2 service error:', err.message);
      return NextResponse.json({ error: 'Storage temporarily unavailable' }, { status: 502 });
    }

    // Unknown / network error
    console.error('[proxy-image] Unexpected error:', err);
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
