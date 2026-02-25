'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GalleryGrid } from './gallery-grid';
import { getPublicGalleryPage } from '@/actions/gallery';
import type { GalleryMediaItem } from '@/actions/gallery';

import { GallerySkeleton } from './gallery-skeleton';
import { ShareSheet } from '@/components/story/share-sheet';
import { FaceSearchButton } from './face-search-button';
import { FaceSearchSheet } from './face-search-sheet';

interface GalleryPageClientProps {
    initialMedia: GalleryMediaItem[];
    albums: { id: string; name: string }[];
    eventHash: string;
    eventName: string;
    description: string | null;
    totalCount: number;
    initialPhotoId?: string;
    initialAlbumId?: string;
    allowDownload?: boolean;
    photoOrder?: 'oldest_first' | 'newest_first';
    logoUrl?: string;
    coverUrl?: string;
    mobileCoverUrl?: string;
    faceSearchEnabled?: boolean;
}

export function GalleryPageClient({
    initialMedia,
    albums,
    eventHash,
    eventName,
    description,
    totalCount,
    initialPhotoId,
    initialAlbumId,
    allowDownload,
    photoOrder = 'oldest_first',
    logoUrl,
    coverUrl,
    mobileCoverUrl,
    faceSearchEnabled = false,
}: GalleryPageClientProps) {
    // Validate initialAlbumId — only use if it matches an actual album
    const validInitialAlbum = initialAlbumId && albums.some(a => a.id === initialAlbumId) ? initialAlbumId : null;
    const [activeAlbum, setActiveAlbum] = useState<string | null>(validInitialAlbum);
    const [media, setMedia] = useState<GalleryMediaItem[]>(initialMedia);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(initialMedia.length < totalCount);
    const [error, setError] = useState('');
    const [revoked, setRevoked] = useState(false);
    const [copied, setCopied] = useState(false);
    const [faceSearchOpen, setFaceSearchOpen] = useState(false);

    const sentinelRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Refs mirror state so the IntersectionObserver callback never goes stale
    const hasMoreRef = useRef(initialMedia.length < totalCount);
    const mediaRef = useRef<GalleryMediaItem[]>(initialMedia);
    const activeAlbumRef = useRef<string | null>(null);
    const loadMoreRef = useRef<(() => void) | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Track whether this is the initial mount (skip scroll on first render)
    const isInitialMount = useRef(true);

    // Reset when album changes
    useEffect(() => {
        setError('');
        // Only scroll on album switch, not on initial page load
        if (isInitialMount.current) {
            isInitialMount.current = false;
        } else {
            // Scroll to top of gallery section on album switch
            document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Sync URL with album selection (replaceState to avoid polluting history)
        const url = new URL(window.location.href);
        if (activeAlbum) {
            url.searchParams.set('album', activeAlbum);
        } else {
            url.searchParams.delete('album');
        }
        window.history.replaceState({}, '', url.toString());
        // Cancel any pending retry from the previous album
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        if (activeAlbum === null) {
            setMedia(initialMedia);
            mediaRef.current = initialMedia;
            hasMoreRef.current = initialMedia.length < totalCount;
            setHasMore(initialMedia.length < totalCount);
        } else {
            // Album selected — fetch from scratch (null cursor = start of sorted order)
            setMedia([]);
            mediaRef.current = [];
            hasMoreRef.current = true;
            setHasMore(true);
            setLoading(true);
            getPublicGalleryPage(eventHash, null, activeAlbum, albumNamesRef.current, photoOrder)
                .then(({ media: newMedia, hasMore: more }) => {
                    setMedia(newMedia);
                    setHasMore(more);
                })
                .catch(() => setError('Failed to load photos'))
                .finally(() => setLoading(false));
        }
    }, [activeAlbum, eventHash, initialMedia, totalCount, photoOrder]);

    // Keep refs in sync with state (read latest values without stale closures)
    useEffect(() => { mediaRef.current = media; }, [media]);
    useEffect(() => { activeAlbumRef.current = activeAlbum; }, [activeAlbum]);

    // Helper: check if sentinel is currently visible in the viewport (with margin)
    const isSentinelVisible = useCallback(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return false;
        const rect = sentinel.getBoundingClientRect();
        return rect.top < window.innerHeight + 600; // match rootMargin
    }, []);

    // Schedule a retry if sentinel is still visible after load completes.
    // Clears any pending retry first to avoid stacking.
    const scheduleRetryIfNeeded = useCallback(() => {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        if (!hasMoreRef.current) return;
        // Wait a tick for React to flush the new media into the DOM,
        // then check if the sentinel is still in/near the viewport.
        retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            if (hasMoreRef.current && !loadingRef.current && isSentinelVisible()) {
                loadMoreRef.current?.();
            }
        }, 300); // 300ms gives React time to render new images & push sentinel down
    }, [isSentinelVisible]);

    // Load more photos — reads ALL state from refs (no stale closures)
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMoreRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setError('');
        try {
            // Read latest media from ref — never stale
            const currentMedia = mediaRef.current;
            const lastItem = currentMedia[currentMedia.length - 1];
            const cursor = lastItem?.created_at || null;
            const { media: newMedia, hasMore: more } = await getPublicGalleryPage(
                eventHash,
                cursor,
                activeAlbumRef.current,
                albumNamesRef.current,
                photoOrder,
            );
            setMedia((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const unique = newMedia.filter((m) => !existingIds.has(m.id));
                const next = [...prev, ...unique];
                // Sync ref immediately so next loadMore sees latest media
                mediaRef.current = next;
                return next;
            });
            hasMoreRef.current = more;
            setHasMore(more);
        } catch {
            setError('Failed to load more photos. Please try again.');
        } finally {
            setLoading(false);
            loadingRef.current = false;
            // After load + render, check if we need to keep loading
            scheduleRetryIfNeeded();
        }
    }, [eventHash, photoOrder, scheduleRetryIfNeeded]);

    // Keep loadMoreRef pointing at the latest loadMore so the observer never goes stale
    loadMoreRef.current = loadMore;

    // Intersection observer — created ONCE, never torn down on re-renders.
    // Uses refs for hasMore/loadMore so it never needs to be recreated.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreRef.current?.();
                }
            },
            { rootMargin: '600px' },
        );

        observer.observe(sentinel);
        return () => {
            observer.disconnect();
            // Clean up any pending retry timer
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — observer is stable, state accessed via refs

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

    const [shareMenuOpen, setShareMenuOpen] = useState(false);
    const [headerShareSheetOpen, setHeaderShareSheetOpen] = useState(false);
    const shareMenuRef = useRef<HTMLDivElement>(null);

    // Close share menu on outside click
    useEffect(() => {
        if (!shareMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
                setShareMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [shareMenuOpen]);

    // Build gallery URL (without album param)
    const getGalleryUrl = useCallback(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('album');
        url.searchParams.delete('photo');
        return url.toString();
    }, []);

    // Build album-specific URL
    const getAlbumUrl = useCallback(() => {
        const url = new URL(window.location.href);
        if (activeAlbum) {
            url.searchParams.set('album', activeAlbum);
        }
        url.searchParams.delete('photo');
        return url.toString();
    }, [activeAlbum]);

    const activeAlbumName = activeAlbum ? albums.find(a => a.id === activeAlbum)?.name : null;

    const copyToClipboard = async (text: string) => {
        try { await navigator.clipboard.writeText(text); }
        catch {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    const shareOrCopy = async (url: string, title: string) => {
        if (navigator.share) {
            try { await navigator.share({ title, url }); }
            catch { /* cancelled */ }
        } else {
            copyToClipboard(url);
        }
        setShareMenuOpen(false);
    };

    const handleShareClick = () => {
        setShareMenuOpen(prev => !prev);
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

                        {/* Right: Share */}
                        <div className="relative flex-shrink-0 ml-4" ref={shareMenuRef}>
                            <button
                                onClick={handleShareClick}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                title="Share"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                            </button>
                            {/* Share dropdown — only when album is selected */}
                            {shareMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-40 animate-in fade-in slide-in-from-top-1">
                                    <button
                                        onClick={() => shareOrCopy(getGalleryUrl(), eventName)}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="font-medium">{activeAlbum ? 'Share Entire Gallery' : 'Copy Link'}</div>
                                        <div className="text-[11px] text-gray-400 mt-0.5">{activeAlbum ? 'All albums & photos' : 'Share gallery URL'}</div>
                                    </button>
                                    {activeAlbum && (
                                        <button
                                            onClick={() => shareOrCopy(getAlbumUrl(), `${eventName} — ${activeAlbumName}`)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="font-medium">Share This Album</div>
                                            <div className="text-[11px] text-gray-400 mt-0.5">{activeAlbumName}</div>
                                        </button>
                                    )}
                                    <div className="border-t border-gray-100 my-1" />
                                    <button
                                        onClick={() => { setShareMenuOpen(false); setHeaderShareSheetOpen(true); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="font-medium flex items-center gap-2">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18.01" /></svg>
                                            Share to Story
                                        </div>
                                        <div className="text-[11px] text-gray-400 mt-0.5">Create branded story card</div>
                                    </button>
                                </div>
                            )}
                            {/* Copied toast */}
                            {copied && (
                                <div className="absolute right-0 top-full mt-1 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg z-40 whitespace-nowrap">
                                    Link copied!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Photo Grid ───────────────────────────────────── */}
            <div className="pt-1 relative">
                <GalleryGrid media={media} eventHash={eventHash} eventName={eventName} logoUrl={logoUrl} initialPhotoId={initialPhotoId} allowDownload={allowDownload} loading={loading} />

                {/* Invisible sentinel — sits inside the grid container,
                    positioned to trigger ~800px before the user reaches the end.
                    This ensures loading fires while the user is still viewing images,
                    not after they've scrolled past into empty space. */}
                <div
                    ref={sentinelRef}
                    className="absolute bottom-0 left-0 w-full pointer-events-none"
                    style={{ height: '1px' }}
                    aria-hidden="true"
                />
            </div>

            {/* ── Loading / Error / End ──────────────────────────── */}
            {loading && (
                <div className="w-full">
                    <GallerySkeleton />
                </div>
            )}
            {error && (
                <div className="py-8 text-center">
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
                <div className="py-8 flex justify-center">
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-sm font-medium transition-colors"
                    >
                        Return to Top
                    </button>
                </div>
            )}
            {/* Share sheet for gallery header */}
            {media.length > 0 && (
                <ShareSheet
                    isOpen={headerShareSheetOpen}
                    onClose={() => setHeaderShareSheetOpen(false)}
                    photoUrl={mobileCoverUrl || coverUrl || media[0].full_url || media[0].original_url}
                    eventName={eventName}
                    logoUrl={logoUrl}
                    galleryUrl={typeof window !== 'undefined' ? getGalleryUrl() : ''}
                />
            )}

            {/* Face Search — only when organizer has enabled it */}
            {!revoked && media.length > 0 && faceSearchEnabled && (
                <>
                    <FaceSearchButton onClick={() => setFaceSearchOpen(true)} />
                    <FaceSearchSheet
                        isOpen={faceSearchOpen}
                        onClose={() => setFaceSearchOpen(false)}
                        eventHash={eventHash}
                        albums={albums}
                        onPhotoClick={(mediaId) => {
                            // Find the photo in the loaded media and open lightbox
                            // The GalleryGrid component handles its own lightbox
                            const photoEl = document.querySelector(`[data-media-id="${mediaId}"]`);
                            if (photoEl) {
                                (photoEl as HTMLElement).click();
                            } else {
                                // Photo might not be loaded yet — open via URL
                                window.history.pushState({}, '', `?photo=${mediaId}`);
                                window.location.reload();
                            }
                        }}
                    />
                </>
            )}
        </>
    );
}
