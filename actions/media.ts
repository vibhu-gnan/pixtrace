'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteR2WithTracking } from '@/lib/storage/r2-cleanup';
import { getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';
import { decrementStorageUsed } from '@/lib/plans/limits';

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
  created_at?: string;
  /** 1200×1200 preview WebP — used for grid + lightbox initial view */
  preview_url: string;
  /** Full-resolution original — loaded after intent detection in lightbox */
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

  // Supabase PostgREST caps at 1000 rows per request by default.
  // Get total count first, then fetch in parallel batches of 1000.
  const batchSize = 1000;

  const { count: totalCount } = await supabase
    .from('media')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (!totalCount || totalCount === 0) return [];

  // Build all range requests needed, run in parallel
  const batches: Promise<any[]>[] = [];
  for (let from = 0; from < totalCount; from += batchSize) {
    batches.push(
      (async () => {
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
          .range(from, from + batchSize - 1);
        if (error) { console.error('Error fetching media batch:', error); return []; }
        return data || [];
      })()
    );
  }

  const batchResults = await Promise.all(batches);
  const allMedia: any[] = batchResults.flat();

  return Promise.all(allMedia.map(async (item: any) => ({
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
    preview_url: item.media_type === 'image' ? await getPreviewUrl(item.r2_key, item.preview_r2_key) : '',
    original_url: item.media_type === 'image' ? await getOriginalUrl(item.r2_key) : '',
    created_at: item.created_at || new Date().toISOString(),
  })));
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

  // Fetch R2 keys and file size before deleting
  const { data: mediaRow } = await supabase
    .from('media')
    .select('r2_key, thumbnail_r2_key, preview_r2_key, file_size')
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

  // Decrement storage usage
  if (mediaRow.file_size) {
    decrementStorageUsed(organizer.id, mediaRow.file_size).catch((err) => {
      console.error('Error decrementing storage:', err);
    });
  }

  // Clean up R2 files (fire-and-forget with orphan tracking)
  const r2Keys: string[] = [];
  if (mediaRow.r2_key) r2Keys.push(mediaRow.r2_key);
  if (mediaRow.thumbnail_r2_key) r2Keys.push(mediaRow.thumbnail_r2_key);
  if (mediaRow.preview_r2_key) r2Keys.push(mediaRow.preview_r2_key);
  if (r2Keys.length > 0) {
    deleteR2WithTracking(r2Keys, 'media_delete');
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

const MAX_BULK_DELETE = 500; // Safety cap: max media items per batch delete

export async function deleteMultipleMedia(mediaIds: string[], eventId: string) {
  if (!mediaIds?.length) return { success: true, deleted: 0 };

  if (mediaIds.length > MAX_BULK_DELETE) {
    return { error: `Cannot delete more than ${MAX_BULK_DELETE} items at once` };
  }

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

  // Fetch R2 keys and file sizes before deleting
  const { data: mediaRows } = await supabase
    .from('media')
    .select('r2_key, thumbnail_r2_key, preview_r2_key, file_size')
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

  // Decrement storage usage
  if (mediaRows && mediaRows.length > 0) {
    const totalBytes = mediaRows.reduce((sum, row) => sum + (row.file_size || 0), 0);
    if (totalBytes > 0) {
      decrementStorageUsed(organizer.id, totalBytes).catch((err) => {
        console.error('Error decrementing storage:', err);
      });
    }
  }

  // Clean up R2 files (fire-and-forget with orphan tracking)
  if (mediaRows && mediaRows.length > 0) {
    const r2Keys: string[] = [];
    for (const row of mediaRows) {
      if (row.r2_key) r2Keys.push(row.r2_key);
      if (row.thumbnail_r2_key) r2Keys.push(row.thumbnail_r2_key);
      if (row.preview_r2_key) r2Keys.push(row.preview_r2_key);
    }
    if (r2Keys.length > 0) {
      deleteR2WithTracking(r2Keys, 'multi_media_delete');
    }
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true, deleted: mediaIds.length };
}
