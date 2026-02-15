'use server';

import { getPublicClient } from '@/lib/supabase/public';
import { getThumbnailUrl, getBlurPlaceholderUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

export interface HeroSlide {
    url: string;
    mediaId: string;
}

export type HeroMode = 'single' | 'slideshow' | 'auto';

export interface GalleryEvent {
    id: string;
    name: string;
    description: string | null;
    event_date: string | null;
    event_end_date?: string | null;
    event_hash?: string;
    cover_media_id?: string | null;
    theme?: {
        logoUrl?: string; // Added logoUrl
        hero?: {
            mode?: HeroMode;
            slideshowMediaIds?: string[];
            intervalMs?: number;
        };
    };
    allow_download?: boolean;
    allow_slideshow?: boolean;
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
    coverUrl: string | null;
    heroSlides: HeroSlide[];
    heroMode: HeroMode;
    heroIntervalMs: number;
}> {
    const supabase = getPublicClient();

    // 1. Fetch Event Details by hash
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, description, event_date, event_end_date, event_hash, cover_media_id, theme, allow_download, allow_slideshow')
        .eq('event_hash', identifier)
        .eq('is_public', true)
        .single() as unknown as { data: GalleryEvent | null; error: any };

    if (eventError || !event) {
        return { event: null, media: [], albums: [], totalCount: 0, coverUrl: null, heroSlides: [], heroMode: 'single', heroIntervalMs: 5000 };
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
        return { event, media: [], albums: albums ? albums.map(a => ({ id: a.id, name: a.name })) : [], totalCount: count || 0, coverUrl: null, heroSlides: [], heroMode: 'single', heroIntervalMs: 5000 };
    }

    // Build album name lookup
    const albumMap = new Map<string, string>();
    for (const a of (albums || [])) {
        albumMap.set(a.id, a.name);
    }

    const media = mapMediaRows(mediaRows || [], albumMap);

    // 5. Resolve cover image URL (may not be in first page of media)
    let coverUrl: string | null = null;
    if (event.cover_media_id) {
        // Check if it's already in the fetched page
        const inPage = media.find(m => m.id === event.cover_media_id);
        if (inPage) {
            coverUrl = inPage.full_url || inPage.original_url;
        } else {
            // Fetch the cover media separately
            const { data: coverRow } = await supabase
                .from('media')
                .select('r2_key, preview_r2_key')
                .eq('id', event.cover_media_id)
                .single();
            if (coverRow) {
                coverUrl = getPreviewUrl(coverRow.r2_key, coverRow.preview_r2_key) || getOriginalUrl(coverRow.r2_key);
            }
        }
    }

    // 6. Resolve hero slides based on hero mode
    const heroConfig = (event.theme as any)?.hero;
    const heroMode: HeroMode = heroConfig?.mode ?? 'single';
    const heroIntervalMs: number = heroConfig?.intervalMs ?? 5000;
    let heroSlides: HeroSlide[] = [];

    if (heroMode === 'slideshow' && heroConfig?.slideshowMediaIds?.length) {
        // Fetch all slideshow media in one query
        const { data: slideshowMedia } = await supabase
            .from('media')
            .select('id, r2_key, preview_r2_key')
            .in('id', heroConfig.slideshowMediaIds)
            .eq('event_id', event.id);

        // Re-order to match saved order (DB doesn't guarantee order)
        const mediaMap = new Map((slideshowMedia ?? []).map((m: any) => [m.id, m]));
        heroSlides = (heroConfig.slideshowMediaIds as string[])
            .map((id: string) => {
                const m = mediaMap.get(id);
                if (!m) return null;
                const url = getPreviewUrl(m.r2_key, m.preview_r2_key) || getOriginalUrl(m.r2_key);
                return { url, mediaId: id };
            })
            .filter((s): s is HeroSlide => s !== null);

    } else if (heroMode === 'auto') {
        // Use first 5 images from the event
        const { data: autoMedia } = await supabase
            .from('media')
            .select('id, r2_key, preview_r2_key')
            .eq('event_id', event.id)
            .eq('media_type', 'image')
            .order('created_at', { ascending: true })
            .limit(5);

        heroSlides = (autoMedia ?? []).map((m: any) => ({
            url: getPreviewUrl(m.r2_key, m.preview_r2_key) || getOriginalUrl(m.r2_key),
            mediaId: m.id,
        }));

    } else {
        // mode === 'single' (or unset): wrap existing coverUrl
        if (coverUrl) {
            heroSlides = [{ url: coverUrl, mediaId: event.cover_media_id ?? '' }];
        }
    }

    return {
        event,
        media,
        albums: (albums || []).map(a => ({ id: a.id, name: a.name })),
        totalCount: count || 0,
        coverUrl,
        heroSlides,
        heroMode,
        heroIntervalMs,
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
    const supabase = getPublicClient();

    // Verify event is still public
    const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('event_hash', eventHash)
        .eq('is_public', true)
        .single() as unknown as { data: { id: string } | null; error: any };

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

