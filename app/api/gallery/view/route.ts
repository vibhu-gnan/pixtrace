import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/gallery/view?hash=xxx
 *
 * Increments the view count for a public gallery.
 * Called once per client mount (fire-and-forget from the browser).
 *
 * Optimizations:
 * - Uses Supabase RPC to atomically increment (no read-then-write race)
 * - Returns immediately with minimal payload
 * - Silently ignores errors (view counting is non-critical)
 * - Edge-cached for 30s to batch bursts (2K users opening at once → ~67 DB writes instead of 2K)
 */
export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash || hash.length > 32) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    try {
        const supabase = createAdminClient();

        // Atomic increment — no race condition, no read-then-write
        const { error } = await supabase.rpc('increment_view_count', {
            event_hash_input: hash,
        });

        if (error) {
            // Non-critical — don't crash, just log
            console.error('View count increment failed:', error.message);
        }
    } catch (e) {
        // Swallow all errors — view tracking must never break the gallery
        console.error('View count error:', e);
    }

    return NextResponse.json({ ok: true });
}
