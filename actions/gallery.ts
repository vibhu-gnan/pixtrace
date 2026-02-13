'use server';

import { createClient } from '@/lib/auth';
import { getThumbnailUrl, getBlurPlaceholderUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

export interface GalleryEvent {
    id: string;
    name: string;
    description: string | null;
    event_date: string | null;
}

export interface GalleryMediaItem {
    id: string;
    album_id: string;
    album_name: string;
    original_filename: string;
    media_type: 'image' | 'video';
    width: number | null;
    height: number | null;
    thumbnail_url: string;
    blur_url: string;
    full_url: string;
    original_url: string;
}

/**
 * Fetch a public event and its media by event_hash.
 * No auth required — RLS policies enforce is_public=true.
 */
export async function getPublicGallery(eventHash: string): Promise<{
    event: GalleryEvent | null;
    media: GalleryMediaItem[];
    albums: { id: string; name: string }[];
}> {
    const supabase = await createClient();

    // 1. Fetch the event (RLS ensures only public events are returned)
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, description, event_date')
        .eq('event_hash', eventHash)
        .eq('is_public', true)
        .single();

    if (eventError || !event) {
        return { event: null, media: [], albums: [] };
    }

    // 2. Fetch albums for this event
    const { data: albums } = await supabase
        .from('albums')
        .select('id, name, sort_order')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true });

    // 3. Fetch all media for this event
    const { data: mediaRows, error: mediaError } = await supabase
        .from('media')
        .select('id, album_id, r2_key, original_filename, media_type, width, height, thumbnail_r2_key, preview_r2_key')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

    if (mediaError) {
        console.error('Error fetching gallery media:', mediaError);
        return { event, media: [], albums: albums || [] };
    }

    // Build album name lookup
    const albumMap = new Map<string, string>();
    for (const a of (albums || [])) {
        albumMap.set(a.id, a.name);
    }

    const media: GalleryMediaItem[] = (mediaRows || []).map((item: any) => ({
        id: item.id,
        album_id: item.album_id,
        album_name: albumMap.get(item.album_id) || 'Unknown',
        original_filename: item.original_filename,
        media_type: item.media_type,
        width: item.width,
        height: item.height,
        thumbnail_url: item.media_type === 'image' ? getThumbnailUrl(item.r2_key, 200, item.thumbnail_r2_key) : '',
        blur_url: item.media_type === 'image' ? getBlurPlaceholderUrl(item.r2_key, item.thumbnail_r2_key) : '',
        full_url: item.media_type === 'image' ? getPreviewUrl(item.r2_key, item.preview_r2_key) : '',
        original_url: item.media_type === 'image' ? getOriginalUrl(item.r2_key) : '',
    }));

    return {
        event,
        media,
        albums: (albums || []).map(a => ({ id: a.id, name: a.name })),
    };
}
