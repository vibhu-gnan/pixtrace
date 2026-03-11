'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteR2WithTracking } from '@/lib/storage/r2-cleanup';
import { decrementStorageUsed } from '@/lib/plans/limits';
import { getPreviewUrl } from '@/lib/storage/cloudflare-images';

export interface AlbumData {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  media_count?: number;
  cover_url?: string | null;
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

  // Verify event belongs to organizer before fetching albums
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return [];

  const { data: albums, error } = await supabase
    .from('albums')
    .select(`
      *,
      media(count)
    `)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching albums:', error);
    return [];
  }

  // Fetch exactly one cover image per album via Postgres DISTINCT ON (returns N rows for N albums)
  const albumIds = (albums || []).map((a: any) => a.id);
  const coverMap = new Map<string, string>();

  if (albumIds.length > 0) {
    // Primary: RPC with DISTINCT ON (1 row per album)
    const { data: coverMedia, error: coverErr } = await supabase
      .rpc('get_album_covers', { album_ids: albumIds });

    let coverRows: Array<{ album_id: string; preview_r2_key: string | null; r2_key: string }> = [];

    if (coverMedia && !coverErr) {
      coverRows = coverMedia;
    } else {
      // Fallback: client-side dedup if RPC unavailable
      const { data: fallbackMedia } = await supabase
        .from('media')
        .select('album_id, preview_r2_key, r2_key')
        .in('album_id', albumIds)
        .eq('media_type', 'image')
        .order('created_at', { ascending: true });

      if (fallbackMedia) {
        const seen = new Set<string>();
        for (const m of fallbackMedia) {
          if (!seen.has(m.album_id)) {
            seen.add(m.album_id);
            coverRows.push(m);
          }
        }
      }
    }

    // Sign presigned URLs in parallel (R2 bucket is private)
    await Promise.all(
      coverRows.map(async (m) => {
        const url = await getPreviewUrl(m.r2_key, m.preview_r2_key);
        if (url) coverMap.set(m.album_id, url);
      })
    );
  }

  return (albums || []).map((album: any) => ({
    ...album,
    media_count: album.media?.[0]?.count ?? 0,
    cover_url: coverMap.get(album.id) || null,
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

  // Fetch R2 keys + sizes BEFORE deleting (cascade will remove media rows)
  // Wrapped in try-catch so fetch failure doesn't block album deletion
  let mediaRows: { r2_key: string | null; thumbnail_r2_key: string | null; preview_r2_key: string | null; file_size: number | null; variant_size_bytes: number | null }[] | null = null;
  try {
    const { data } = await supabase
      .from('media')
      .select('r2_key, thumbnail_r2_key, preview_r2_key, file_size, variant_size_bytes')
      .eq('album_id', albumId)
      .eq('event_id', eventId);
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

  // Decrement storage usage (original + variants for all media in this album)
  if (mediaRows && mediaRows.length > 0) {
    const totalBytes = mediaRows.reduce(
      (sum, row) => sum + (row.file_size || 0) + (row.variant_size_bytes || 0),
      0,
    );
    if (totalBytes > 0) {
      decrementStorageUsed(organizer.id, totalBytes).catch((err) => {
        console.error('Error decrementing storage for album delete:', err);
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
      deleteR2WithTracking(r2Keys, 'album_delete');
    }
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}
