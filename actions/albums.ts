'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteObjects } from '@/lib/storage/r2-client';

export interface AlbumData {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  media_count?: number;
}

export async function createAlbum(eventId: string, formData: FormData) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || null;

  if (!name?.trim()) {
    return { error: 'Album name is required' };
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
    return { error: 'Event not found' };
  }

  // Get the next sort order
  const { data: lastAlbum } = await supabase
    .from('albums')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (lastAlbum?.sort_order ?? -1) + 1;

  const { data: album, error } = await supabase
    .from('albums')
    .insert({
      event_id: eventId,
      name: name.trim(),
      description,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating album:', error);
    return { error: 'Failed to create album' };
  }

  revalidatePath(`/events/${eventId}`);
  return { data: album };
}

export async function getAlbums(eventId: string): Promise<AlbumData[]> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return [];

  const supabase = createAdminClient();

  const { data: albums, error } = await supabase
    .from('albums')
    .select(`
      *,
      media (id)
    `)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching albums:', error);
    return [];
  }

  return (albums || []).map((album: any) => ({
    ...album,
    media_count: album.media?.length || 0,
    media: undefined,
  }));
}

export async function updateAlbum(albumId: string, eventId: string, formData: FormData) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || null;

  if (!name?.trim()) {
    return { error: 'Album name is required' };
  }

  const supabase = createAdminClient();

  // Verify event belongs to organizer before updating album
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return { error: 'Event not found' };

  const { error } = await supabase
    .from('albums')
    .update({
      name: name.trim(),
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', albumId)
    .eq('event_id', eventId);

  if (error) {
    console.error('Error updating album:', error);
    return { error: 'Failed to update album' };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function deleteAlbum(albumId: string, eventId: string) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  // Verify event belongs to organizer before deleting album
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return { error: 'Event not found' };

  // Fetch R2 keys BEFORE deleting (cascade will remove media rows)
  // Wrapped in try-catch so fetch failure doesn't block album deletion
  let mediaRows: { r2_key: string | null; thumbnail_r2_key: string | null; preview_r2_key: string | null }[] | null = null;
  try {
    const { data } = await supabase
      .from('media')
      .select('r2_key, thumbnail_r2_key, preview_r2_key')
      .eq('album_id', albumId);
    mediaRows = data;
  } catch (fetchErr) {
    console.error('Error fetching R2 keys for album (continuing with deletion):', fetchErr);
  }

  const { error } = await supabase
    .from('albums')
    .delete()
    .eq('id', albumId)
    .eq('event_id', eventId);

  if (error) {
    console.error('Error deleting album:', error);
    return { error: 'Failed to delete album' };
  }

  // Clean up R2 files (fire-and-forget, non-blocking)
  // Wrapped in try-catch to ensure no crash even on unexpected errors
  try {
    if (mediaRows && mediaRows.length > 0) {
      const r2Keys: string[] = [];
      for (const row of mediaRows) {
        if (row.r2_key) r2Keys.push(row.r2_key);
        if (row.thumbnail_r2_key) r2Keys.push(row.thumbnail_r2_key);
        if (row.preview_r2_key) r2Keys.push(row.preview_r2_key);
      }
      if (r2Keys.length > 0) {
        deleteObjects(r2Keys).catch((err) => {
          console.error('Error deleting R2 objects for album:', err);
        });
      }
    }
  } catch (cleanupErr) {
    console.error('Unexpected error during R2 cleanup (album already deleted):', cleanupErr);
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}
