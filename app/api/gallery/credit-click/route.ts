import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCreditChannel } from '@/lib/credit/types';

/**
 * POST /api/gallery/credit-click?hash=xxx&channel=whatsapp
 *
 * Records that a guest tapped one of the photographer's contact channels, so
 * the photographer can see what the credit is actually earning them.
 *
 * Structure mirrors /api/gallery/view — including the reason it does NOT batch:
 * Vercel serverless keeps no in-memory state between invocations, so Maps and
 * timers are useless. One atomic upsert per tap instead.
 *
 * Counts live in `credit_click_counts`, NOT on `events`. That is deliberate and
 * load-bearing: `anon` holds a table-level SELECT grant on events, so a column
 * there would let anyone read a photographer's enquiry volume straight off
 * /rest/v1/events. Do not "simplify" it back.
 *
 * Safety:
 * - Channel is whitelisted here AND inside the RPC. The RPC's copy is the real
 *   boundary; this one just turns a bad request into a clean 400.
 * - The RPC self-gates on is_public, so private galleries cannot be probed.
 * - EXECUTE on the RPC is revoked from anon/authenticated, so this route (which
 *   runs as service_role) is the only way in.
 * - No rate limiting, by the same reasoning as /api/gallery/view: the only
 *   thing at stake is a vanity number on the organizer's own dashboard. No
 *   money, no email, no storage, no PII.
 * - Client deduplicates per channel per page view.
 */

const HASH_RE = /^[a-zA-Z0-9_-]{6,32}$/;

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');
    const channel = searchParams.get('channel');

    if (!hash || !HASH_RE.test(hash)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!isCreditChannel(channel)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }

    try {
        const supabase = createAdminClient();
        // Awaited: Vercel kills the process once the response is sent, so an
        // unawaited promise here would simply be dropped.
        await supabase.rpc('increment_credit_click', {
            event_hash_input: hash,
            channel_input: channel,
        });
    } catch {
        // Analytics are non-critical — never fail a guest's navigation for them.
    }

    return NextResponse.json({ ok: true });
}
