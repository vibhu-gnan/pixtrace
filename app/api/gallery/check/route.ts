import { NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/supabase/public';

/**
 * GET /api/gallery/check?hash=xxx
 *
 * Heartbeat: checks if a gallery is still public.
 * Edge-cached for 5 min so 2K concurrent viewers share 1 DB query.
 * Uses public (anon) client so RLS enforces is_public=true as a defense-in-depth layer.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash || hash.length > 32) {
        return NextResponse.json({ public: false });
    }

    try {
        const supabase = getPublicClient();
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
