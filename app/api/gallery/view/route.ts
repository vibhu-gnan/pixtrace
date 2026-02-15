import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/gallery/view?hash=xxx
 *
 * Increments the view count for a public gallery.
 * Uses in-memory batching to coalesce concurrent views:
 * - Accumulates counts per event hash
 * - Flushes to DB every 30 seconds or when batch reaches 50
 * - 2K users opening at once → 1 DB write instead of 2K
 */

// In-memory batch: { eventHash → pendingCount }
const pendingViews = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const FLUSH_THRESHOLD = 50; // flush early if any hash accumulates this many

async function flushViews() {
    if (pendingViews.size === 0) return;

    // Snapshot and clear
    const batch = new Map(pendingViews);
    pendingViews.clear();

    const supabase = createAdminClient();

    for (const [hash, count] of batch) {
        try {
            // increment_view_count RPC increments by 1 each call
            // For batch > 1, call the RPC count times, or use a direct update
            // Direct update is more efficient for batches
            await supabase.rpc('increment_view_count_by', {
                event_hash_input: hash,
                amount: count,
            }).then(async (res) => {
                // If the _by variant doesn't exist, fall back to single increments
                if (res.error?.code === '42883') { // function does not exist
                    for (let i = 0; i < count; i++) {
                        await supabase.rpc('increment_view_count', {
                            event_hash_input: hash,
                        });
                    }
                }
            });
        } catch (e) {
            console.error(`View flush failed for ${hash}:`, e);
            // Don't re-queue — view counts are non-critical
        }
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

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash || hash.length > 32) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Accumulate in memory
    pendingViews.set(hash, (pendingViews.get(hash) || 0) + 1);

    // Flush immediately if threshold reached, otherwise schedule
    const count = pendingViews.get(hash) || 0;
    if (count >= FLUSH_THRESHOLD) {
        // Don't await — flush in background
        flushViews().catch(() => { });
    } else {
        scheduleFlush();
    }

    return NextResponse.json({ ok: true });
}
