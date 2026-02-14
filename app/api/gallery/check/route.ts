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

    if (!event) {
        return NextResponse.json({ public: false });
    }

    return NextResponse.json({ public: true });
}
