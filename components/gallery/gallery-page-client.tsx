'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GalleryGrid } from './gallery-grid';
import { getPublicGalleryPage } from '@/actions/gallery';
import type { GalleryMediaItem } from '@/actions/gallery';

import { GallerySkeleton } from './gallery-skeleton';

interface GalleryPageClientProps {
    initialMedia: GalleryMediaItem[];
    albums: { id: string; name: string }[];
    eventHash: string;
    eventName: string;
    description: string | null;
    totalCount: number;
    initialPhotoId?: string;
    allowDownload?: boolean;
}

export function GalleryPageClient({
    initialMedia,
    albums,
    eventHash,
    eventName,
    description,
    totalCount,
    initialPhotoId,
    allowDownload,
}: GalleryPageClientProps) {
    const [activeAlbum, setActiveAlbum] = useState<string | null>(null);
    const [media, setMedia] = useState<GalleryMediaItem[]>(initialMedia);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialMedia.length < totalCount);
    const [error, setError] = useState('');
    const [revoked, setRevoked] = useState(false);
    const [copied, setCopied] = useState(false);

    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);
    const lastLoadTimeRef = useRef(0);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Pre-compute album name map to pass to server action (avoids re-querying albums per scroll page)
    const albumNamesRef = useRef<Record<string, string>>(
        Object.fromEntries(albums.map(a => [a.id, a.name]))
    );

    // Track gallery view — fire exactly once, guarded against StrictMode double-mount
    const viewTrackedRef = useRef(false);
    useEffect(() => {
        if (viewTrackedRef.current) return;
        viewTrackedRef.current = true;
        fetch(`/api/gallery/view?hash=${eventHash}`, {
            method: 'POST',
            keepalive: true,
        }).catch(() => { });
    }, [eventHash]);

    // Reset when album changes
    useEffect(() => {
        setError('');
        if (activeAlbum === null) {
            setMedia(initialMedia);
            setHasMore(initialMedia.length < totalCount);
        } else {
            // Album selected — fetch from scratch (null cursor = start from newest)
            setMedia([]);
            setHasMore(true);
            setLoading(true);
            getPublicGalleryPage(eventHash, null, activeAlbum, albumNamesRef.current)
                .then(({ media: newMedia, hasMore: more }) => {
                    setMedia(newMedia);
                    setHasMore(more);
                })
                .catch(() => setError('Failed to load photos'))
                .finally(() => setLoading(false));
        }
    }, [activeAlbum, eventHash, initialMedia, totalCount]);

    // Load more photos — cursor-based, throttled to prevent rapid-fire
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMore) return;
        // Throttle: minimum 1s between requests
        const now = Date.now();
        if (now - lastLoadTimeRef.current < 1000) return;
        lastLoadTimeRef.current = now;
        loadingRef.current = true;
        setLoading(true);
        setError('');
        try {
            const lastItem = media[media.length - 1];
            const cursor = lastItem?.created_at || null;
            const { media: newMedia, hasMore: more } = await getPublicGalleryPage(
                eventHash,
                cursor,
                activeAlbum,
                albumNamesRef.current,
            );
            setMedia((prev) => {
                // Deduplicate
                const existingIds = new Set(prev.map((m) => m.id));
                const unique = newMedia.filter((m) => !existingIds.has(m.id));
                return [...prev, ...unique];
            });
            setHasMore(more);
        } catch {
            setError('Failed to load more photos. Please try again.');
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [hasMore, eventHash, media, activeAlbum]);

    // Intersection observer for infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    loadMore();
                }
            },
            { rootMargin: '600px' }, // Start loading 600px before user reaches bottom
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loading, loadMore]);

    // Heartbeat: check ~every 5min if gallery is still public
    // Random jitter (±1 min) prevents all 2K clients from hitting at the same instant
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        let stopped = false;

        const check = async () => {
            try {
                const res = await fetch(`/api/gallery/check?hash=${eventHash}`);
                const data = await res.json();
                if (!data.public) {
                    setRevoked(true);
                    return; // stop scheduling
                }
            } catch { /* skip */ }
            if (!stopped) {
                const jitter = 240_000 + Math.random() * 120_000; // 4–6 min
                timeout = setTimeout(check, jitter);
            }
        };

        const initialDelay = 240_000 + Math.random() * 120_000;
        timeout = setTimeout(check, initialDelay);
        return () => { stopped = true; clearTimeout(timeout); };
    }, [eventHash]);

    const handleCopyLink = async () => {
        const url = window.location.href;
        try { await navigator.clipboard.writeText(url); }
        catch {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: eventName, url }); }
            catch { /* cancelled */ }
        } else {
            handleCopyLink();
        }
    };

    // Revoked overlay
    if (revoked) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Gallery No Longer Available</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                    The organizer has made this gallery private. Contact them for access.
                </p>
            </div>
        );
    }



    return (
        <>
            {/* ── Sticky Info Bar ───────────────────────────────── */}
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14">
                        {/* Left: Event name + description */}
                        <div className="flex items-center gap-6 min-w-0 overflow-x-auto">
                            <div className="flex-shrink-0">
                                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide leading-tight">{eventName}</h2>
                                {description && (
                                    <p className="text-[11px] text-gray-400 leading-tight">{description}</p>
                                )}
                            </div>

                            {/* Album tabs */}
                            {albums.length > 1 && (
                                <div className="relative group flex-shrink-0">
                                    <nav className="flex items-center gap-2 pr-12">
                                        <button
                                            onClick={() => setActiveAlbum(null)}
                                            className={`px-4 py-1.5 text-xs font-semibold tracking-wide uppercase whitespace-nowrap rounded-full transition-all ${activeAlbum === null
                                                ? 'bg-gray-900 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                                                }`}
                                        >
                                            All
                                        </button>
                                        {albums.map((album) => {
                                            const isActive = activeAlbum === album.id;
                                            return (
                                                <button
                                                    key={album.id}
                                                    onClick={() => setActiveAlbum(album.id)}
                                                    className={`px-4 py-1.5 text-xs font-semibold tracking-wide uppercase whitespace-nowrap rounded-full transition-all ${isActive
                                                        ? 'bg-gray-900 text-white shadow-sm'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                                                        }`}
                                                >
                                                    {album.name}
                                                </button>
                                            );
                                        })}
                                    </nav>
                                    {/* Gradient to indicate scroll */}
                                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
                                </div>
                            )}
                        </div>

                        {/* Right: Action icons */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            {/* Share */}
                            <button
                                onClick={handleShare}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                title="Share"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Photo Grid ───────────────────────────────────── */}
            <div className="px-1 pt-1">
                <GalleryGrid media={media} eventHash={eventHash} initialPhotoId={initialPhotoId} allowDownload={allowDownload} />
            </div>

            {/* ── Infinite Scroll Sentinel + Loading ───────────── */}
            <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center">
                {loading && (
                    <div className="w-full px-1">
                        <GallerySkeleton />
                    </div>
                )}
                {error && (
                    <div className="text-center">
                        <p className="text-sm text-red-500 mb-2">{error}</p>
                        <button
                            onClick={loadMore}
                            className="text-sm text-blue-600 hover:underline font-medium"
                        >
                            Try again
                        </button>
                    </div>
                )}
                {!hasMore && !loading && media.length > 0 && (
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="mt-4 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-sm font-medium transition-colors"
                    >
                        Return to Top
                    </button>
                )}
            </div>
        </>
    );
}
