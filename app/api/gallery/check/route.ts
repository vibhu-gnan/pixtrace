import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/gallery/check?hash=xxx
 *
 * Heartbeat: checks if a gallery is still public.
 * Edge-cached for 5 min so 2K concurrent viewers share 1 DB query.
 * Uses admin client (no cookie parsing needed for a public check).
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash || hash.length > 32) {
        return NextResponse.json({ public: false });
    }

    try {
        const supabase = createAdminClient();
        const { data: event } = await supabase
            .from('events')
            .select('id')
            .eq('event_hash', hash)
            .eq('is_public', true)
            .single();

        const isPublic = !!event;
        const res = NextResponse.json({ public: isPublic });

        // Edge-cache for 5 min — all concurrent viewers share this response
        res.headers.set(
            'Cache-Control',
            's-maxage=300, stale-while-revalidate=60',
        );

        return res;
    } catch (e) {
        // Fail closed: on error, treat as private (never expose private events on DB outage)
        console.error('Gallery check error:', e);
        return NextResponse.json({ public: false }, { status: 503 });
    }
}
