import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { incrementStorageUsed } from '@/lib/plans/limits';

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

    // Verify event belongs to organizer — fetch event_hash at same time
    // so we can revalidate the public gallery without a second DB round-trip
    const { data: event } = await supabase
      .from('events')
      .select('id, event_hash')
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

    // Track storage usage (original + variant sizes like thumbnail/preview)
    const variantSizeBytes = body.variantSizeBytes || 0;
    const totalBytes = fileSize + variantSizeBytes;
    if (totalBytes > 0) {
      try {
        await incrementStorageUsed(organizer.id, totalBytes);
      } catch (err) {
        console.error('Error tracking storage:', err);
      }
    }

    // Enqueue face processing job (images only, non-blocking)
    if (mediaType === 'image' && media) {
      try {
        await supabase.from('face_processing_jobs').insert({
          event_id: eventId,
          media_id: media.id,
          status: 'pending',
          attempt_count: 0,
          max_attempts: 3,
        });

        // Fire-and-forget: trigger face processing immediately
        const triggerUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/face/trigger`;
        fetch(triggerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Face-Secret': process.env.FACE_PROCESSING_SECRET || '',
          },
        }).catch(() => {}); // Non-blocking, ignore errors
      } catch (jobErr) {
        // Don't fail the upload if face job creation fails
        console.error('Failed to enqueue face processing job:', jobErr);
      }
    }

    // Revalidate dashboard paths
    revalidatePath(`/events/${eventId}/photos`);
    revalidatePath(`/events/${eventId}`);

    // Revalidate public gallery so new photos appear immediately
    // (without this, ISR cache could serve stale content for up to 1 hour)
    if (event.event_hash) {
      revalidatePath(`/gallery/${event.event_hash}`);
    }

    return NextResponse.json({ media });
  } catch (error) {
    console.error('Error in upload complete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
