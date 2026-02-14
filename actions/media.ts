'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteObjects } from '@/lib/storage/r2-client';
import { getThumbnailUrl, getBlurPlaceholderUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

export interface MediaItem {
  id: string;
  album_id: string;
  event_id: string;
  r2_key: string;
  original_filename: string;
  media_type: 'image' | 'video';
  mime_type: string | null;
  file_size: number;
  width: number | null;
  height: number | null;
  processing_status: string;
  created_at: string;
  thumbnail_url: string;
  blur_url: string;
  full_url: string;
  original_url: string;
}

export async function getMedia(eventId: string): Promise<MediaItem[]> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return [];

  const supabase = createAdminClient();

  // Verify event belongs to organizer
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return [];

  const { data: media, error } = await supabase
    .from('media')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching media:', error);
    return [];
  }

  return (media || []).map((item: any) => ({
    id: item.id,
    album_id: item.album_id,
    event_id: item.event_id,
    r2_key: item.r2_key,
    original_filename: item.original_filename,
    media_type: item.media_type,
    mime_type: item.mime_type,
    file_size: item.file_size,
    width: item.width,
    height: item.height,
    processing_status: item.processing_status,
    created_at: item.created_at,
    thumbnail_url: item.media_type === 'image' ? getThumbnailUrl(item.r2_key, 200, item.preview_r2_key) : '',
    blur_url: item.media_type === 'image' ? getBlurPlaceholderUrl(item.r2_key, item.preview_r2_key) : '',
    full_url: item.media_type === 'image' ? getPreviewUrl(item.r2_key, item.preview_r2_key) : '',
    original_url: item.media_type === 'image' ? getOriginalUrl(item.r2_key) : '',
  }));
}

export async function deleteMedia(mediaId: string, eventId: string) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  // Verify event belongs to organizer
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return { error: 'Event not found' };

  // Fetch R2 keys before deleting
  const { data: mediaRow } = await supabase
    .from('media')
    .select('r2_key, thumbnail_r2_key, preview_r2_key')
    .eq('id', mediaId)
    .eq('event_id', eventId)
    .single();

  if (!mediaRow) return { error: 'Media not found' };

  // Delete from DB
  const { error } = await supabase
    .from('media')
    .delete()
    .eq('id', mediaId)
    .eq('event_id', eventId);

  if (error) {
    console.error('Error deleting media:', error);
    return { error: 'Failed to delete media' };
  }

  // Clean up R2 files (fire-and-forget)
  const r2Keys: string[] = [];
  if (mediaRow.r2_key) r2Keys.push(mediaRow.r2_key);
  if (mediaRow.thumbnail_r2_key) r2Keys.push(mediaRow.thumbnail_r2_key);
  if (mediaRow.preview_r2_key) r2Keys.push(mediaRow.preview_r2_key);
  if (r2Keys.length > 0) {
    deleteObjects(r2Keys).catch((err) => {
      console.error('Error deleting R2 objects:', err);
    });
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function deleteMultipleMedia(mediaIds: string[], eventId: string) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  // Verify event belongs to organizer
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return { error: 'Event not found' };

  // Fetch R2 keys before deleting
  const { data: mediaRows } = await supabase
    .from('media')
    .select('r2_key, thumbnail_r2_key, preview_r2_key')
    .eq('event_id', eventId)
    .in('id', mediaIds);

  // Delete from DB
  const { error } = await supabase
    .from('media')
    .delete()
    .eq('event_id', eventId)
    .in('id', mediaIds);

  if (error) {
    console.error('Error deleting media:', error);
    return { error: 'Failed to delete media' };
  }

  // Clean up R2 files (fire-and-forget)
  if (mediaRows && mediaRows.length > 0) {
    const r2Keys: string[] = [];
    for (const row of mediaRows) {
      if (row.r2_key) r2Keys.push(row.r2_key);
      if (row.thumbnail_r2_key) r2Keys.push(row.thumbnail_r2_key);
      if (row.preview_r2_key) r2Keys.push(row.preview_r2_key);
    }
    if (r2Keys.length > 0) {
      deleteObjects(r2Keys).catch((err) => {
        console.error('Error deleting R2 objects:', err);
      });
    }
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, deleted: mediaIds.length };
}
