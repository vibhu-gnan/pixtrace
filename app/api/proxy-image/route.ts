import { NextRequest, NextResponse } from 'next/server';
import { getR2ObjectStream, R2ConfigError, R2AccessError } from '@/lib/storage/r2-client';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_PROXY_SIZE = 25 * 1024 * 1024; // 25MB max

export async function GET(request: NextRequest) {
  const r2Key = request.nextUrl.searchParams.get('r2Key');
  if (!r2Key) {
    return NextResponse.json({ error: 'Missing r2Key parameter' }, { status: 400 });
  }

  // Path-traversal prevention — only allow safe R2 key characters
  if (r2Key.includes('..') || r2Key.startsWith('/') || r2Key.startsWith('//') || /[^\w/._-]/.test(r2Key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  try {
    // Streaming: checks Content-Length BEFORE reading body, then pipes directly
    const { stream, contentType, contentLength } = await getR2ObjectStream(r2Key, MAX_PROXY_SIZE);

    const safeContentType = ALLOWED_CONTENT_TYPES.find(t => contentType.startsWith(t)) || 'image/jpeg';

    return new Response(stream, {
      headers: {
        'Content-Type': safeContentType,
        'Cache-Control': 'public, max-age=86400',
        ...(contentLength > 0 && { 'Content-Length': contentLength.toString() }),
      },
    });
  } catch (err) {
    // ── Classified error responses ──
    if (err instanceof R2ConfigError) {
      console.error('[proxy-image] R2 not configured:', err.message);
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    if (err instanceof R2AccessError) {
      if (err.statusCode === 413) {
        return NextResponse.json({ error: 'File too large' }, { status: 413 });
      }
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
