import { NextRequest, NextResponse } from 'next/server';
import { getR2ObjectStream, R2ConfigError, R2AccessError } from '@/lib/storage/r2-client';
import { getPublicClient } from '@/lib/supabase/public';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_PROXY_SIZE = 25 * 1024 * 1024; // 25MB max

/**
 * Checks that an R2 key belongs to authorized content before proxying.
 *
 * Authorization passes if ANY of the following is true:
 *  1. The key is a media/variant for a public event (RLS enforces is_public=true on anon key)
 *  2. The key is a cover image for a public event
 *  3. The requesting user is an organizer who owns the media (private event dashboard previews)
 */
async function authorizeProxyAccess(r2Key: string, request: NextRequest): Promise<boolean> {
  const pub = getPublicClient();

  // 1. Media (original, preview, or thumbnail variant) in a public event
  const { data: mediaMatch } = await pub
    .from('media')
    .select('id')
    .or(`r2_key.eq.${r2Key},preview_r2_key.eq.${r2Key},thumbnail_r2_key.eq.${r2Key}`)
    .limit(1)
    .maybeSingle();

  if (mediaMatch) return true;

  // 2. Cover image for a public event
  const { data: coverMatch } = await pub
    .from('events')
    .select('id')
    .eq('cover_r2_key', r2Key)
    .limit(1)
    .maybeSingle();

  if (coverMatch) return true;

  // 3. Organizer owns this media (handles private-event dashboard / logo previews)
  try {
    const organizer = await getCurrentOrganizer();
    if (organizer) {
      const admin = createAdminClient();
      const { data: owned } = await admin
        .from('media')
        .select('id, events!inner(organizer_id)')
        .or(`r2_key.eq.${r2Key},preview_r2_key.eq.${r2Key},thumbnail_r2_key.eq.${r2Key}`)
        .eq('events.organizer_id', organizer.id)
        .limit(1)
        .maybeSingle();
      if (owned) return true;
    }
  } catch {
    // Auth unavailable — fall through to deny
  }

  return false;
}

export async function GET(request: NextRequest) {
  const r2Key = request.nextUrl.searchParams.get('r2Key');
  if (!r2Key) {
    return NextResponse.json({ error: 'Missing r2Key parameter' }, { status: 400 });
  }

  // Path-traversal prevention — only allow safe R2 key characters
  if (r2Key.includes('..') || r2Key.startsWith('/') || r2Key.startsWith('//') || /[^\w/._-]/.test(r2Key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  if (!(await authorizeProxyAccess(r2Key, request))) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
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
