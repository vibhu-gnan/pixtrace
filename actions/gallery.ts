'use server';

import { createClient } from '@/lib/auth';
import { getThumbnailUrl, getBlurPlaceholderUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

export interface GalleryEvent {
    id: string;
    name: string;
    description: string | null;
    event_date: string | null;
    event_hash?: string;
    cover_media_id?: string | null;
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
    created_at?: string;
}

const PAGE_SIZE = 30;

/**
 * Fetch a public event and its first page of media by event_hash.
 * No auth required — RLS policies enforce is_public=true.
 */
export async function getPublicGallery(identifier: string): Promise<{
    event: GalleryEvent | null;
    media: GalleryMediaItem[];
    albums: { id: string; name: string }[];
    totalCount: number;
    hero: { type: 'image' | 'slideshow'; urls: string[] } | null;
}> {
    const supabase = await createClient();

    // 1. Fetch Event Details (by hash OR slug)
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, description, event_date, event_hash, cover_media_id')
        .or(`event_hash.eq.${identifier},slug.eq.${identifier}`)
        .eq('is_public', true)
        .single();

    if (eventError || !event) {
        return { event: null, media: [], albums: [], totalCount: 0, hero: null };
    }

    // 2. Fetch albums for this event
    const { data: albums } = await supabase
        .from('albums')
        .select('id, name, sort_order')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true });

    // 3. Get total count of media
    const { count } = await supabase
        .from('media')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id);

    // 4. Fetch first page of media
    const { data: mediaRows, error: mediaError } = await supabase
        .from('media')
        .select('id, album_id, r2_key, original_filename, media_type, width, height, thumbnail_r2_key, preview_r2_key, created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

    if (mediaError) {
        console.error('Error fetching gallery media:', mediaError);
        return { event, media: [], albums: albums ? albums.map(a => ({ id: a.id, name: a.name })) : [], totalCount: count || 0, hero: null };
    }

    // Build album name lookup
    const albumMap = new Map<string, string>();
    for (const a of (albums || [])) {
        albumMap.set(a.id, a.name);
    }

    const media = mapMediaRows(mediaRows || [], albumMap);

    return {
        event,
        media,
        albums: (albums || []).map(a => ({ id: a.id, name: a.name })),
        totalCount: count || 0,
        hero: null,
    };
}

/**
 * Fetch a page of media for a public gallery using cursor-based pagination.
 * `cursor` is the `created_at` timestamp of the last loaded item.
 * Cursor pagination is O(1) regardless of depth — no row scanning.
 * albumNames is passed from the client (already loaded on initial page) to avoid re-querying albums.
 */
export async function getPublicGalleryPage(
    eventHash: string,
    cursor?: string | null,
    albumId?: string | null,
    albumNames?: Record<string, string>,
): Promise<{
    media: GalleryMediaItem[];
    hasMore: boolean;
}> {
    const supabase = await createClient();

    // Verify event is still public
    const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('event_hash', eventHash)
        .eq('is_public', true)
        .single();

    if (!event) {
        return { media: [], hasMore: false };
    }

    // Use album names from client instead of re-fetching
    const albumMap = new Map<string, string>(Object.entries(albumNames || {}));

    // Build query — cursor-based: "give me items older than this timestamp"
    let query = supabase
        .from('media')
        .select('id, album_id, r2_key, original_filename, media_type, width, height, thumbnail_r2_key, preview_r2_key, created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

    if (cursor) {
        query = query.lt('created_at', cursor);
    }

    if (albumId) {
        query = query.eq('album_id', albumId);
    }

    // Fetch one extra to determine hasMore
    const { data: mediaRows, error } = await query.limit(PAGE_SIZE + 1);

    if (error) {
        console.error('Error fetching gallery page:', error);
        return { media: [], hasMore: false };
    }

    const rows = mediaRows || [];
    const hasMore = rows.length > PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    return {
        media: mapMediaRows(pageRows, albumMap),
        hasMore,
    };
}

// ─── Helpers ──────────────────────────────────────────────────

function mapMediaRows(
    rows: any[],
    albumMap: Map<string, string>,
): GalleryMediaItem[] {
    return rows.map((item: any) => ({
        id: item.id,
        album_id: item.album_id,
        album_name: albumMap.get(item.album_id) || 'Unknown',
        original_filename: item.original_filename,
        media_type: item.media_type,
        width: item.width,
        height: item.height,
        thumbnail_url: item.media_type === 'image' ? getThumbnailUrl(item.r2_key, 200, item.preview_r2_key) : '',
        blur_url: item.media_type === 'image' ? getBlurPlaceholderUrl(item.r2_key, item.preview_r2_key) : '',
        full_url: item.media_type === 'image' ? getPreviewUrl(item.r2_key, item.preview_r2_key) : '',
        original_url: item.media_type === 'image' ? getOriginalUrl(item.r2_key) : '',
        created_at: item.created_at || new Date().toISOString(), // Fallback for old items
    }));
}

