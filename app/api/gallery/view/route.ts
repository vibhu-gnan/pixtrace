import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/gallery/view?hash=xxx[&album=uuid]
 *
 * Increments view counts for public galleries and optionally albums.
 * Uses in-memory batching to coalesce concurrent views:
 * - Accumulates counts per key (event hash / album UUID)
 * - Flushes to DB every 30 seconds or when total pending reaches threshold
 * - 2K users opening at once → 1 DB write instead of 2K
 *
 * Safety:
 * - Flush guard prevents overlapping flushes (no double-writes)
 * - Snapshot-and-clear pattern means pending map is always consistent
 * - All DB errors are swallowed (view counts are non-critical)
 * - Input validation rejects malformed hashes/UUIDs
 * - RPC clamps amount to [1, 10000] server-side
 */

// ─── Batching state ─────────────────────────────────────────────

// Event views: { eventHash → pendingCount }
const pendingEventViews = new Map<string, number>();
// Album views: { albumId → pendingCount }
const pendingAlbumViews = new Map<string, number>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false; // guard against overlapping flushes

const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const FLUSH_THRESHOLD = 50;       // flush early when total pending hits this

// ─── Validation helpers ─────────────────────────────────────────

const HASH_RE = /^[a-zA-Z0-9_-]{6,32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Flush logic ────────────────────────────────────────────────

async function flushViews() {
    if (flushing) return; // another flush is already running
    if (pendingEventViews.size === 0 && pendingAlbumViews.size === 0) return;

    flushing = true;
    try {
        // Snapshot and clear atomically
        const eventBatch = new Map(pendingEventViews);
        pendingEventViews.clear();
        const albumBatch = new Map(pendingAlbumViews);
        pendingAlbumViews.clear();

        const supabase = createAdminClient();

        // Flush event views
        const eventPromises = Array.from(eventBatch).map(async ([hash, count]) => {
            try {
                const res = await supabase.rpc('increment_view_count_by', {
                    event_hash_input: hash,
                    amount: count,
                });
                // Fallback if _by variant doesn't exist yet
                if (res.error?.code === '42883') {
                    for (let i = 0; i < Math.min(count, 100); i++) {
                        await supabase.rpc('increment_view_count', { event_hash_input: hash });
                    }
                }
            } catch (e) {
                console.error(`Event view flush failed for ${hash}:`, e);
            }
        });

        // Flush album views
        const albumPromises = Array.from(albumBatch).map(async ([albumId, count]) => {
            try {
                await supabase.rpc('increment_album_view_count', {
                    album_id_input: albumId,
                    amount: count,
                });
            } catch (e) {
                console.error(`Album view flush failed for ${albumId}:`, e);
            }
        });

        // Run all flushes in parallel — independent operations
        await Promise.allSettled([...eventPromises, ...albumPromises]);
    } finally {
        flushing = false;
    }
}

function scheduleFlush() {
    if (!flushTimer) {
        flushTimer = setTimeout(async () => {
            flushTimer = null;
            await flushViews();
        }, FLUSH_INTERVAL_MS);
    }
}

function getTotalPending(): number {
    let total = 0;
    for (const v of pendingEventViews.values()) total += v;
    for (const v of pendingAlbumViews.values()) total += v;
    return total;
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

    // Accumulate event view
    pendingEventViews.set(hash, (pendingEventViews.get(hash) || 0) + 1);

    // Accumulate album view if provided
    if (albumId) {
        pendingAlbumViews.set(albumId, (pendingAlbumViews.get(albumId) || 0) + 1);
    }

    // Flush immediately if threshold reached, otherwise schedule
    if (getTotalPending() >= FLUSH_THRESHOLD) {
        flushViews().catch(() => { });
    } else {
        scheduleFlush();
    }

    return NextResponse.json({ ok: true });
}
