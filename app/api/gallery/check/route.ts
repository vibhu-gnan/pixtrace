import { NextResponse } from 'next/server';
import { createClient } from '@/lib/auth';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash) {
        return NextResponse.json({ public: false });
    }

    const supabase = await createClient();
    const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('event_hash', hash)
        .eq('is_public', true)
        .single();

    const isPublic = !!event;
    const res = NextResponse.json({ public: isPublic });

    // Edge-cache for 5 min — matches heartbeat interval so all concurrent
    // viewers share a single cached response instead of each hitting Supabase.
    res.headers.set(
        'Cache-Control',
        's-maxage=300, stale-while-revalidate=60',
    );

    return res;
}
