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
        .select('id, is_public')
        .eq('event_hash', hash)
        .eq('is_public', true)
        .single();

    if (!event) {
        return NextResponse.json({ public: false });
    }

    // Get the timestamp of the latest media item
    const { data: latestMedia } = await supabase
        .from('media')
        .select('created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return NextResponse.json({
        public: true,
        last_updated: latestMedia?.created_at || null
    });
}
