import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      eventId,
      albumId,
      r2Key,
      originalFilename,
      mediaType,
      mimeType,
      fileSize,
      width,
      height,
      previewR2Key,
    } = body;

    if (!eventId || !albumId || !r2Key || !originalFilename || !mediaType || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify event belongs to organizer
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('organizer_id', organizer.id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Create media record
    const { data: media, error } = await supabase
      .from('media')
      .insert({
        album_id: albumId,
        event_id: eventId,
        r2_key: r2Key,
        original_filename: originalFilename,
        media_type: mediaType,
        mime_type: mimeType,
        file_size: fileSize,
        width: width || null,
        height: height || null,
        preview_r2_key: previewR2Key || null,
        processing_status: 'completed',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating media record:', error);
      return NextResponse.json(
        { error: 'Failed to create media record' },
        { status: 500 }
      );
    }

    // Revalidate Next.js cache to show new photos immediately
    revalidatePath(`/events/${eventId}/photos`);
    revalidatePath(`/events/${eventId}`);

    return NextResponse.json({ media });
  } catch (error) {
    console.error('Error in upload complete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
