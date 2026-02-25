'use server';

import { getPublicClient } from '@/lib/supabase/public';
import { getThumbnailUrl, getBlurPlaceholderUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images';

export interface HeroSlide {
    url: string;
    mediaId: string;
    width?: number | null;
    height?: number | null;
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
        logoUrl?: string;
        hero?: {
            mode?: HeroMode;
            slideshowMediaIds?: string[];        // desktop/landscape
            mobileSlideshowMediaIds?: string[];  // portrait/mobile override
            intervalMs?: number;
        };
    };
    allow_download?: boolean;
    allow_slideshow?: boolean;
    face_search_enabled?: boolean;
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

function resolvePhotoOrder(theme: unknown): 'oldest_first' | 'newest_first' {
    const val = (theme as Record<string, unknown> | null)?.photo_order;
    return val === 'newest_first' ? 'newest_first' : 'oldest_first';
}

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
    mobileHeroSlides: HeroSlide[];  // portrait/mobile override — empty means use heroSlides
    heroMode: HeroMode;
    heroIntervalMs: number;
    photoOrder: 'oldest_first' | 'newest_first';
}> {
    const supabase = getPublicClient();

    // ── Local row types (supabase-js without a DB generic returns `never`
    //    for untyped queries; explicit casts here keep the file type-safe) ──
    type EventRow = GalleryEvent & { id: string };
    type AlbumRow = { id: string; name: string; sort_order: number };
    type MediaRow = {
        id: string; album_id: string; r2_key: string; original_filename: string;
        media_type: string; width: number | null; height: number | null;
        thumbnail_r2_key: string | null; preview_r2_key: string | null; created_at: string;
    };
    type CoverRow = { r2_key: string; preview_r2_key: string | null };
    type SlideRow = { id: string; r2_key: string; preview_r2_key: string | null };

    // 1. Fetch Event Details by hash
    const { data: event, error: eventError } = await (supabase
        .from('events')
        .select('*')
        .eq('event_hash', identifier)
        .eq('is_public', true)
        .single() as unknown as Promise<{ data: EventRow | null; error: unknown }>);

    if (eventError || !event) {
        return { event: null, media: [], albums: [], totalCount: 0, coverUrl: null, heroSlides: [], mobileHeroSlides: [], heroMode: 'single', heroIntervalMs: 5000, photoOrder: 'oldest_first' };
    }

    // 2. Fetch albums for this event
    const { data: albums } = await (supabase
        .from('albums')
        .select('id, name, sort_order')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true }) as unknown as Promise<{ data: AlbumRow[] | null; error: unknown }>);

    // 3. Get total count of media
    const { count } = await supabase
        .from('media')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id);

    // 4. Fetch first page of media (order controlled by theme.photo_order)
    const photoOrderSetting = resolvePhotoOrder(event.theme);
    const ascending = photoOrderSetting !== 'newest_first';

    const { data: mediaRows, error: mediaError } = await (supabase
        .from('media')
        .select('id, album_id, r2_key, original_filename, media_type, width, height, thumbnail_r2_key, preview_r2_key, created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending })
        .range(0, PAGE_SIZE - 1) as unknown as Promise<{ data: MediaRow[] | null; error: unknown }>);

    if (mediaError) {
        console.error('Error fetching gallery media:', mediaError);
        return { event, media: [], albums: (albums || []).map(a => ({ id: a.id, name: a.name })), totalCount: count || 0, coverUrl: null, heroSlides: [], mobileHeroSlides: [], heroMode: 'single', heroIntervalMs: 5000, photoOrder: photoOrderSetting as 'oldest_first' | 'newest_first' };
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
        const inPage = media.find(m => m.id === event.cover_media_id);
        if (inPage) {
            coverUrl = inPage.full_url || inPage.original_url;
        } else {
            const { data: coverRow } = await (supabase
                .from('media')
                .select('r2_key, preview_r2_key')
                .eq('id', event.cover_media_id)
                .single() as unknown as Promise<{ data: CoverRow | null; error: unknown }>);
            if (coverRow) {
                coverUrl = getPreviewUrl(coverRow.r2_key, coverRow.preview_r2_key) || getOriginalUrl(coverRow.r2_key);
            }
        }
    }

    // 6. Resolve hero slides based on hero mode
    const heroConfig = (event.theme as Record<string, any>)?.hero;
    const heroMode: HeroMode = heroConfig?.mode ?? 'single';
    const heroIntervalMs: number = heroConfig?.intervalMs ?? 5000;
    let heroSlides: HeroSlide[] = [];

    if (heroMode === 'slideshow' && heroConfig?.slideshowMediaIds?.length) {
        const { data: slideshowMedia } = await (supabase
            .from('media')
            .select('id, r2_key, preview_r2_key')
            .in('id', heroConfig.slideshowMediaIds)
            .eq('event_id', event.id) as unknown as Promise<{ data: SlideRow[] | null; error: unknown }>);

        const mediaMap = new Map((slideshowMedia ?? []).map(m => [m.id, m]));
        heroSlides = (heroConfig.slideshowMediaIds as string[])
            .map((id: string) => {
                const m = mediaMap.get(id);
                if (!m) return null;
                const url = getPreviewUrl(m.r2_key, m.preview_r2_key) || getOriginalUrl(m.r2_key);
                return { url, mediaId: id };
            })
            .filter((s): s is HeroSlide => s !== null);

    } else if (heroMode === 'auto') {
        const { data: autoMedia } = await (supabase
            .from('media')
            .select('id, r2_key, preview_r2_key')
            .eq('event_id', event.id)
            .eq('media_type', 'image')
            .order('created_at', { ascending: true })
            .limit(5) as unknown as Promise<{ data: SlideRow[] | null; error: unknown }>);

        heroSlides = (autoMedia ?? []).map(m => ({
            url: getPreviewUrl(m.r2_key, m.preview_r2_key) || getOriginalUrl(m.r2_key),
            mediaId: m.id,
        }));

    } else {
        if (coverUrl) {
            heroSlides = [{ url: coverUrl, mediaId: event.cover_media_id ?? '' }];
        }
    }

    // 7. Resolve mobile-specific slideshow (portrait phones) if configured
    type MobileSlideRow = SlideRow & { width: number | null; height: number | null };
    let mobileHeroSlides: HeroSlide[] = [];
    if (heroMode === 'slideshow' && heroConfig?.mobileSlideshowMediaIds?.length) {
        const { data: mobileMedia } = await (supabase
            .from('media')
            .select('id, r2_key, preview_r2_key, width, height')
            .in('id', heroConfig.mobileSlideshowMediaIds)
            .eq('event_id', event.id) as unknown as Promise<{ data: MobileSlideRow[] | null; error: unknown }>);

        const mobileMap = new Map((mobileMedia ?? []).map(m => [m.id, m]));
        mobileHeroSlides = (heroConfig.mobileSlideshowMediaIds as string[])
            .map((id: string) => {
                const m = mobileMap.get(id);
                if (!m) return null;
                const url = getPreviewUrl(m.r2_key, m.preview_r2_key) || getOriginalUrl(m.r2_key);
                return { url, mediaId: id, width: m.width ?? undefined, height: m.height ?? undefined } as HeroSlide;
            })
            .filter((s): s is HeroSlide => s !== null);
    }

    return {
        event,
        media,
        albums: (albums || []).map(a => ({ id: a.id, name: a.name })),
        totalCount: count || 0,
        coverUrl,
        heroSlides,
        mobileHeroSlides,
        heroMode,
        heroIntervalMs,
        photoOrder: photoOrderSetting as 'oldest_first' | 'newest_first',
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
    photoOrder?: 'oldest_first' | 'newest_first',
): Promise<{
    media: GalleryMediaItem[];
    hasMore: boolean;
}> {
    const supabase = getPublicClient();

    type EventIdRow = { id: string };
    type MediaRow = {
        id: string; album_id: string; r2_key: string; original_filename: string;
        media_type: string; width: number | null; height: number | null;
        thumbnail_r2_key: string | null; preview_r2_key: string | null; created_at: string;
    };

    // Verify event is still public
    const { data: event } = await (supabase
        .from('events')
        .select('id')
        .eq('event_hash', eventHash)
        .eq('is_public', true)
        .single() as unknown as Promise<{ data: EventIdRow | null; error: unknown }>);

    if (!event) {
        return { media: [], hasMore: false };
    }

    // Use album names from client instead of re-fetching
    const albumMap = new Map<string, string>(Object.entries(albumNames || {}));

    // Build query — cursor-based pagination respecting photo order
    const ascending = photoOrder !== 'newest_first';
    let query = supabase
        .from('media')
        .select('id, album_id, r2_key, original_filename, media_type, width, height, thumbnail_r2_key, preview_r2_key, created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending });

    if (cursor) {
        // oldest_first: next page = items AFTER cursor; newest_first: items BEFORE cursor
        query = ascending ? query.gt('created_at', cursor) : query.lt('created_at', cursor);
    }

    if (albumId) {
        query = query.eq('album_id', albumId);
    }

    // Fetch one extra to determine hasMore
    const { data: mediaRows, error } = await (query.limit(PAGE_SIZE + 1) as unknown as Promise<{ data: MediaRow[] | null; error: unknown }>);

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

