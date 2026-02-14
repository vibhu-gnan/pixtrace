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
    created_at?: string;
}

const PAGE_SIZE = 30;

/**
 * Fetch a public event and its first page of media by event_hash.
 * No auth required — RLS policies enforce is_public=true.
 */
export async function getPublicGallery(eventHash: string): Promise<{
    event: GalleryEvent | null;
    media: GalleryMediaItem[];
    albums: { id: string; name: string }[];
    totalCount: number;
    hero: {
        type: 'image' | 'slideshow';
        urls: string[];
    } | null;
}> {
    const supabase = await createClient();

    // 1. Fetch the event (RLS ensures only public events are returned)
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select(`
            id, name, description, event_date,
            cover_type, cover_media_id, cover_r2_key, cover_slideshow_config
        `)
        .eq('event_hash', eventHash)
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

    // 5. Resolve Hero Content
    let hero: { type: 'image' | 'slideshow'; urls: string[] } | null = null;
    const coverType = event.cover_type || 'first';

    try {
        if (coverType === 'single' && event.cover_media_id) {
            // Fetch single media item
            const { data: coverMedia } = await supabase
                .from('media')
                .select('r2_key, preview_r2_key, media_type')
                .eq('id', event.cover_media_id)
                .single();

            if (coverMedia && coverMedia.media_type === 'image') {
                // Prioritize preview, then original, then generic fallback logic (though preview should exist)
                // Using getPreviewUrl
                const url = getPreviewUrl(coverMedia.r2_key, coverMedia.preview_r2_key);
                hero = { type: 'image', urls: [url] };
            }
        } else if (coverType === 'upload' && event.cover_r2_key) {
            // Use R2 key - we treat this as "original" quality for cover, 
            // but we might want a utility that just returns the public URL.
            // Assuming getOriginalUrl works for any R2 key in the public bucket
            // logic is: `${R2_PUBLIC_URL}/${key}`
            const url = getOriginalUrl(event.cover_r2_key);
            hero = { type: 'image', urls: [url] };
        } else if (coverType === 'slideshow' && event.cover_slideshow_config) {
            const config = event.cover_slideshow_config as any;
            let slideRows: any[] = [];

            if (config.type === 'album' && config.albumId) {
                const { data } = await supabase
                    .from('media')
                    .select('r2_key, preview_r2_key')
                    .eq('album_id', config.albumId)
                    .eq('media_type', 'image')
                    .order('created_at', { ascending: false })
                    .limit(10); // Limit slideshow to 10 recent/top items? or user selection?
                slideRows = data || [];
            } else if (config.type === 'custom' && config.mediaIds?.length) {
                const { data } = await supabase
                    .from('media')
                    .select('r2_key, preview_r2_key')
                    .in('id', config.mediaIds)
                    .eq('media_type', 'image');
                // Re-order based on input array? Postgres IN doesn't guarantee order.
                // For now, just use what we get.
                slideRows = data || [];
            }

            if (slideRows.length > 0) {
                const urls = slideRows.map(r => getPreviewUrl(r.r2_key, r.preview_r2_key));
                hero = { type: 'slideshow', urls };
            }
        }
    } catch (e) {
        console.error('Error resolving hero:', e);
        // Fallback to null -> client uses first image
    }

    // Default 'first' falls back to client logic (using first media item),
    // but we can also explicitly return it here if we wanted. 
    // For now, null hero implies "use default/first".

    return {
        event,
        media,
        albums: (albums || []).map(a => ({ id: a.id, name: a.name })),
        totalCount: count || 0,
        hero,
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

