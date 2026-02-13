import { NextResponse } from 'next/server';
import { createClient } from '@/lib/auth';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash) {
        return NextResponse.json({ public: false });
    }

    const supabase = await createClient();
    const { data } = await supabase
        .from('events')
        .select('is_public')
        .eq('event_hash', hash)
        .eq('is_public', true)
        .single();

    return NextResponse.json({ public: !!data });
}
