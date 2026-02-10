import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify event belongs to organizer and get albums
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const { data: albums } = await supabase
    .from('albums')
    .select('id, name')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ albums: albums || [] });
}
