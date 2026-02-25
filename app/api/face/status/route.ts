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

  // Verify event ownership
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Count images (only images get face processing)
  const { count: totalImages } = await supabase
    .from('media')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('media_type', 'image');

  // Count job statuses
  const { data: statusCounts } = await supabase
    .from('face_processing_jobs')
    .select('status')
    .eq('event_id', eventId);

  const counts = { pending: 0, processing: 0, completed: 0, failed: 0, no_faces: 0 };
  for (const row of statusCounts || []) {
    const s = row.status as keyof typeof counts;
    if (s in counts) counts[s]++;
  }

  // Total faces found
  const { data: faceSumData } = await supabase
    .from('face_processing_jobs')
    .select('faces_found')
    .eq('event_id', eventId)
    .in('status', ['completed']);

  const totalFaces = (faceSumData || []).reduce(
    (sum, r) => sum + (r.faces_found || 0),
    0,
  );

  return NextResponse.json({
    total_images: totalImages || 0,
    processed: counts.completed + counts.no_faces,
    pending: counts.pending,
    processing: counts.processing,
    failed: counts.failed,
    no_faces: counts.no_faces,
    total_faces: totalFaces,
  });
}
