import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/gallery/view?hash=xxx[&album=uuid]
 *
 * Increments view counts for public galleries and optionally albums.
 * Writes directly to DB via atomic RPC — no in-memory batching.
 *
 * Why no batching: Vercel serverless functions don't persist in-memory
 * state between requests. Each cold start gets fresh Maps, and timers
 * can be frozen before they fire. Direct writes are simple and reliable.
 *
 * Performance: Each RPC is a single atomic UPDATE (no SELECT), ~5-10ms.
 * Both event + album writes run in parallel, awaited before responding.
 * Client uses keepalive:true and doesn't read the response body, so
 * the ~10ms server-side latency is invisible to the user.
 *
 * Safety:
 * - Input validation rejects malformed hashes/UUIDs before any DB call
 * - RPC only increments albums belonging to public events
 * - RPC clamps amount to [1, 10000] server-side
 * - All DB errors are swallowed (view counts are non-critical)
 * - Client deduplicates per session (Set of tracked album IDs)
 */

// ─── Validation ─────────────────────────────────────────────────

const HASH_RE = /^[a-zA-Z0-9_-]{6,32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── DB writes (awaited, parallel) ──────────────────────────────

async function recordEventView(hash: string) {
    try {
        const supabase = createAdminClient();
        const res = await supabase.rpc('increment_view_count_by', {
            event_hash_input: hash,
            amount: 1,
        });
        // Fallback if _by variant doesn't exist
        if (res.error?.code === '42883') {
            await supabase.rpc('increment_view_count', { event_hash_input: hash });
        }
    } catch {
        // View counts are non-critical — swallow errors
    }
}

async function recordAlbumView(albumId: string) {
    try {
        const supabase = createAdminClient();
        await supabase.rpc('increment_album_view_count', {
            album_id_input: albumId,
            amount: 1,
        });
    } catch {
        // View counts are non-critical — swallow errors
    }
}

// ─── Route handler ──────────────────────────────────────────────

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');
    const albumId = searchParams.get('album');

    // Validate event hash (required)
    if (!hash || !HASH_RE.test(hash)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Validate album ID if provided (optional, must be valid UUID)
    if (albumId && !UUID_RE.test(albumId)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Await DB writes before responding — Vercel serverless kills the
    // process after the response, so unawaited promises get dropped.
    // Both writes run in parallel (~10ms total). Client doesn't await
    // the fetch response, so this latency is invisible to users.
    await Promise.allSettled([
        recordEventView(hash),
        ...(albumId ? [recordAlbumView(albumId)] : []),
    ]);

    return NextResponse.json({ ok: true });
}
