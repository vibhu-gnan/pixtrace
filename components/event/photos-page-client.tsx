'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUploadStore } from '@/lib/upload/upload-manager';
import { UploadBanner } from './upload-banner';
import { StorageLimitModal } from './storage-limit-modal';
import { PhotoGrid } from './photo-grid';
import { AlbumsEmptyState } from './albums-empty-state';
import { SortableAlbumList } from './sortable-album-list';
import { CreateAlbumForm } from '@/components/dashboard/create-album-form';
import { CoverBar } from './cover-bar';
import { ImportTab } from './import-tab';
import { getMediaPage } from '@/actions/media';
import { LoadingSpinner } from '@/components/UI/LoadingStates';
import type { MediaItem } from '@/actions/media';
import type { AlbumData } from '@/actions/albums';
import type { EventData } from '@/actions/events';

// ─── Constants ───────────────────────────────────────────────

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

// ─── Types ───────────────────────────────────────────────────

type ViewMode = 'albums' | 'photos' | 'import';
type AlbumLayout = 'grid' | 'list';

// ─── Icons ───────────────────────────────────────────────────

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ImportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface PhotosPageClientProps {
  eventId: string;
  eventName: string;
  media: MediaItem[];
  albums: AlbumData[];
  event: EventData;
  savedCoverPreviewUrl: string | null;
  logoUrl?: string | null;
  initialHasMore?: boolean;
  totalPhotos?: number;
  totalVideos?: number;
}

function PhotosPageContent({ eventId, eventName, media: initialMedia, albums: initialAlbums, event, savedCoverPreviewUrl, logoUrl, initialHasMore = false, totalPhotos = 0, totalVideos = 0 }: PhotosPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const albumIdFromUrl = searchParams.get('album');

  const { items, isUploading, addFiles, startUpload, storageLimitError, clearStorageLimitError } = useUploadStore();

  // ─── State ───────────────────────────────────────────────
  const [dropdownAlbums, setDropdownAlbums] = useState(initialAlbums.map((a) => ({ id: a.id, name: a.name })));
  const [selectedAlbum, setSelectedAlbum] = useState(albumIdFromUrl || initialAlbums[0]?.id || '');
  const [dragActive, setDragActive] = useState(false);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [albumRefreshKey, setAlbumRefreshKey] = useState(0);
  // ─── Pagination State ────────────────────────────────────
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [scrollLoading, setScrollLoading] = useState(false);
  const [scrollError, setScrollError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const mediaRef = useRef<MediaItem[]>(initialMedia);
  const activeAlbumRef = useRef<string | null>(null);
  const failureCountRef = useRef(0);
  const requestIdRef = useRef(0); // Guards concurrent album switches

  // Default to albums (grid) view; respect ?album= URL param for deep links
  const [viewMode, setViewMode] = useState<ViewMode>(albumIdFromUrl ? 'photos' : 'albums');
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(albumIdFromUrl || null);
  const [albumLayout, setAlbumLayout] = useState<AlbumLayout>('grid');

  // ─── URL Sync ─────────────────────────────────────────────
  // Keep URL in sync with view state (shallow — no server re-fetch)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (activeAlbumId) params.set('album', activeAlbumId);
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, '', url);
  }, [viewMode, activeAlbumId, pathname]);

  // ─── Cover Selection State ─────────────────────────────────
  const [coverSelectionMode, setCoverSelectionMode] = useState<null | 'single' | 'slideshow-custom' | 'slideshow-mobile'>(null);
  const [coverSingleSelectedId, setCoverSingleSelectedId] = useState<string | null>(
    event.cover_media_id ?? null
  );
  const [coverSlideshowSelectedIds, setCoverSlideshowSelectedIds] = useState<Set<string>>(
    new Set((event.theme as any)?.hero?.slideshowMediaIds ?? [])
  );
  const [coverMobileSlideshowSelectedIds, setCoverMobileSlideshowSelectedIds] = useState<Set<string>>(
    new Set((event.theme as any)?.hero?.mobileSlideshowMediaIds ?? [])
  );
  const [heroMode, setHeroMode] = useState<'single' | 'slideshow' | 'auto'>(
    (event.theme as any)?.hero?.mode ?? 'single'
  );

  // ─── Sync on server refresh (e.g. after upload completes) ──
  useEffect(() => {
    // Don't overwrite if we're viewing a specific album (data is album-filtered)
    if (!activeAlbumId) {
      setMedia(initialMedia);
      setHasMore(initialHasMore);
      hasMoreRef.current = initialHasMore;
      mediaRef.current = initialMedia;
      failureCountRef.current = 0;
      setScrollError(null);
    }
  }, [initialMedia, initialHasMore, activeAlbumId]);

  // Fetch album-specific media when arriving via ?album= deep link
  const didInitialAlbumFetch = useRef(false);
  useEffect(() => {
    if (albumIdFromUrl && !didInitialAlbumFetch.current) {
      didInitialAlbumFetch.current = true;
      getMediaPage(eventId, null, undefined, albumIdFromUrl).then(({ media: albumMedia, hasMore: more }) => {
        setMedia(albumMedia);
        mediaRef.current = albumMedia;
        hasMoreRef.current = more;
        setHasMore(more);
      }).catch(() => {
        // Album fetch failed — fall back to showing all media (already loaded from initialMedia)
        console.warn('Album deep-link fetch failed, showing all media');
      });
    }
  }, [albumIdFromUrl, eventId]);

  // Keep refs in sync
  useEffect(() => { mediaRef.current = media; }, [media]);
  useEffect(() => { activeAlbumRef.current = activeAlbumId; }, [activeAlbumId]);

  // ─── Computed Values ─────────────────────────────────────
  const photoCount = totalPhotos;
  const videoCount = totalVideos;
  const albumCount = initialAlbums.length;

  // Album cover URLs are provided server-side via AlbumData.cover_url
  // No client-side media scanning needed — scales regardless of media count

  // Filtered media for photos view
  const filteredMedia = useMemo(() => {
    if (!activeAlbumId) return media;
    return media.filter((m) => m.album_id === activeAlbumId);
  }, [media, activeAlbumId]);

  // Active album name for breadcrumb
  const activeAlbumName = useMemo(() => {
    if (!activeAlbumId) return 'All Photos';
    return initialAlbums.find((a) => a.id === activeAlbumId)?.name || 'Album';
  }, [activeAlbumId, initialAlbums]);

  // ─── Effects ─────────────────────────────────────────────

  // Register image caching service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { });
    }
  }, []);

  // Warn before reload/close during uploads
  useEffect(() => {
    if (!isUploading) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Upload in progress. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  // Block Next.js client-side navigation during uploads
  useEffect(() => {
    if (!isUploading) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href && !anchor.href.includes('#')) {
        const confirmed = window.confirm(
          'Upload is still in progress. If you leave now, pending uploads will be lost.\n\nAre you sure you want to leave?'
        );
        if (!confirmed) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isUploading]);

  // Sync dropdown albums from server props
  useEffect(() => {
    setDropdownAlbums(initialAlbums.map((a) => ({ id: a.id, name: a.name })));
  }, [initialAlbums]);

  // Refresh album list from server when needed
  const fetchAlbums = useCallback(() => {
    fetch(`/api/upload/albums?eventId=${eventId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.albums) {
          setDropdownAlbums(data.albums);
          if (!selectedAlbum && data.albums.length > 0) {
            setSelectedAlbum(data.albums[0].id);
          }
        }
      })
      .catch(() => { });
  }, [eventId, selectedAlbum]);

  useEffect(() => {
    fetchAlbums();
  }, [eventId, albumRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called when a new album is created
  const handleAlbumCreated = useCallback(() => {
    setShowAlbumForm(false);
    setAlbumRefreshKey((k) => k + 1);
    router.refresh();
  }, [router]);

  // Auto-refresh page: every 10 completed uploads + when all done
  const doneCount = items.filter((i) => i.status === 'done').length;
  const lastRefreshBatch = useRef(0);

  useEffect(() => {
    // Refresh every 10 completed uploads during upload
    if (isUploading && doneCount > 0 && doneCount % 10 === 0 && doneCount !== lastRefreshBatch.current) {
      lastRefreshBatch.current = doneCount;
      router.refresh();
    }
    // Final refresh when all uploads complete
    if (!isUploading && doneCount > 0) {
      lastRefreshBatch.current = 0;
      const timer = setTimeout(() => router.refresh(), 500);
      return () => clearTimeout(timer);
    }
  }, [isUploading, doneCount, router]);

  // ─── Handlers ────────────────────────────────────────────

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter((f) =>
        ACCEPTED_TYPES.includes(f.type)
      );
      if (validFiles.length > 0) {
        addFiles(validFiles);
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleUpload = () => {
    if (!selectedAlbum) return;
    startUpload(eventId, selectedAlbum);
  };

  // ─── Infinite Scroll ────────────────────────────────────
  const MAX_FAILURES = 3;
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<(() => void) | null>(null);

  // Check if sentinel is near viewport (matches rootMargin)
  const isSentinelVisible = useCallback(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return false;
    const rect = sentinel.getBoundingClientRect();
    return rect.top < window.innerHeight + 600;
  }, []);

  // After load completes, retry if sentinel is still visible (fills viewport gaps)
  const scheduleRetryIfNeeded = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (!hasMoreRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (hasMoreRef.current && !loadingRef.current && isSentinelVisible()) {
        loadMoreRef.current?.();
      }
    }, 300);
  }, [isSentinelVisible]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current || failureCountRef.current >= MAX_FAILURES) return;
    loadingRef.current = true;
    setScrollLoading(true);
    setScrollError(null);

    try {
      const currentMedia = mediaRef.current;
      const lastItem = currentMedia[currentMedia.length - 1];
      const cursor = lastItem?.created_at || null;
      const { media: newMedia, hasMore: more } = await getMediaPage(
        eventId,
        cursor,
        undefined,
        activeAlbumRef.current,
      );

      setMedia((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = newMedia.filter((m) => !existingIds.has(m.id));
        const next = [...prev, ...unique];
        mediaRef.current = next;
        return next;
      });
      hasMoreRef.current = more;
      setHasMore(more);
      failureCountRef.current = 0;
    } catch (err) {
      failureCountRef.current++;
      console.error('Failed to load more photos:', err);
      if (failureCountRef.current >= MAX_FAILURES) {
        setScrollError('Failed to load more photos.');
      }
    } finally {
      setScrollLoading(false);
      loadingRef.current = false;
      scheduleRetryIfNeeded();
    }
  }, [eventId, scheduleRetryIfNeeded]);

  // Keep ref pointing at latest loadMore so observer never goes stale
  loadMoreRef.current = loadMore;

  // Intersection observer — re-created when viewMode changes because sentinel
  // is conditionally rendered (only in photos view). On mount in albums view,
  // sentinelRef is null; when user switches to photos, sentinel appears and
  // observer needs to attach. Uses refs for all other state (no stale closures).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreRef.current?.();
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]); // re-attach when sentinel appears/disappears with view switch

  const handleAlbumClick = useCallback(async (albumId: string) => {
    setActiveAlbumId(albumId);
    setSelectedAlbum(albumId);
    setViewMode('photos');
    failureCountRef.current = 0;
    setScrollError(null);
    loadingRef.current = true; // Block loadMore during album fetch

    // Guard: ignore stale responses from concurrent clicks
    const myRequestId = ++requestIdRef.current;

    setScrollLoading(true);
    try {
      const { media: albumMedia, hasMore: more } = await getMediaPage(eventId, null, undefined, albumId);
      if (requestIdRef.current !== myRequestId) return; // Superseded by newer click
      setMedia(albumMedia);
      mediaRef.current = albumMedia;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {
      if (requestIdRef.current === myRequestId) {
        console.error('Failed to load album photos');
      }
    } finally {
      if (requestIdRef.current === myRequestId) {
        setScrollLoading(false);
        loadingRef.current = false; // Unblock loadMore
      }
    }
  }, [eventId]);

  const handleBackToAlbums = useCallback(async () => {
    setViewMode('albums');
    setActiveAlbumId(null);
    failureCountRef.current = 0;
    setScrollError(null);

    const myRequestId = ++requestIdRef.current;

    try {
      const { media: allMedia, hasMore: more } = await getMediaPage(eventId);
      if (requestIdRef.current !== myRequestId) return;
      setMedia(allMedia);
      mediaRef.current = allMedia;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {
      if (requestIdRef.current === myRequestId) {
        console.error('Failed to reset media');
      }
    }
  }, [eventId]);

  const handleAllPhotosClick = useCallback(async () => {
    setActiveAlbumId(null);
    setViewMode('photos');
    failureCountRef.current = 0;
    setScrollError(null);
    loadingRef.current = true;

    const myRequestId = ++requestIdRef.current;
    setScrollLoading(true);
    try {
      const { media: allMedia, hasMore: more } = await getMediaPage(eventId);
      if (requestIdRef.current !== myRequestId) return;
      setMedia(allMedia);
      mediaRef.current = allMedia;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {
      if (requestIdRef.current === myRequestId) {
        console.error('Failed to load all photos');
      }
    } finally {
      if (requestIdRef.current === myRequestId) {
        setScrollLoading(false);
        loadingRef.current = false;
      }
    }
  }, [eventId]);

  // ─── Cover Selection Handlers ──────────────────────────────

  const handleCoverPhotoClick = useCallback(
    (mediaId: string) => {
      if (coverSelectionMode === 'single') {
        setCoverSingleSelectedId(mediaId);
      } else if (coverSelectionMode === 'slideshow-custom') {
        setCoverSlideshowSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(mediaId)) next.delete(mediaId);
          else next.add(mediaId);
          return next;
        });
      } else if (coverSelectionMode === 'slideshow-mobile') {
        setCoverMobileSlideshowSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(mediaId)) next.delete(mediaId);
          else next.add(mediaId);
          return next;
        });
      }
    },
    [coverSelectionMode]
  );

  // When entering cover selection mode while in albums view, auto-switch to photos
  useEffect(() => {
    if (coverSelectionMode && viewMode === 'albums') {
      setViewMode('photos');
    }
  }, [coverSelectionMode, viewMode]);

  // Compute the set of cover-selected IDs to pass to PhotoGrid
  const coverSelectedIds = useMemo(() => {
    if (coverSelectionMode === 'single') {
      return coverSingleSelectedId ? new Set([coverSingleSelectedId]) : new Set<string>();
    }
    if (coverSelectionMode === 'slideshow-custom') {
      return coverSlideshowSelectedIds;
    }
    if (coverSelectionMode === 'slideshow-mobile') {
      return coverMobileSlideshowSelectedIds;
    }
    return new Set<string>();
  }, [coverSelectionMode, coverSingleSelectedId, coverSlideshowSelectedIds, coverMobileSlideshowSelectedIds]);

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  // ─── Render ──────────────────────────────────────────────

  return (
    <div>
      {/* Storage Limit Modal — shown when upload is blocked by quota */}
      {storageLimitError && (
        <StorageLimitModal
          info={storageLimitError}
          onClose={clearStorageLimitError}
        />
      )}

      {/* Cover Bar — gallery cover configuration */}
      <CoverBar
        event={event}
        media={media.filter(m => m.media_type === 'image')}
        albums={dropdownAlbums}
        savedCoverPreviewUrl={savedCoverPreviewUrl}
        coverSelectionMode={coverSelectionMode}
        onEnterSelectionMode={setCoverSelectionMode}
        coverSingleSelectedId={coverSingleSelectedId}
        onCoverSingleSelectedChange={setCoverSingleSelectedId}
        coverSlideshowSelectedIds={coverSlideshowSelectedIds}
        onCoverSlideshowSelectedChange={setCoverSlideshowSelectedIds}
        coverMobileSlideshowSelectedIds={coverMobileSlideshowSelectedIds}
        onCoverMobileSlideshowSelectedChange={setCoverMobileSlideshowSelectedIds}
        heroMode={heroMode}
        onHeroModeChange={setHeroMode}
        logoUrl={logoUrl}
      />

      {/* Upload Banner — shows during/after uploads */}
      <UploadBanner eventName={eventName} />

      {/* Upload drop zone */}
      <div
        onDragOver={coverSelectionMode ? undefined : (e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={coverSelectionMode ? undefined : () => setDragActive(false)}
        onDrop={coverSelectionMode ? undefined : handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-6 ${
          coverSelectionMode
            ? 'border-gray-200 bg-gray-50 opacity-50 pointer-events-none'
            : dragActive
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
          }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Album selector */}
          <select
            value={selectedAlbum}
            onChange={(e) => setSelectedAlbum(e.target.value)}
            className="rounded-lg border-0 py-2 px-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-500 bg-white"
            disabled={isUploading}
          >
            <option value="">Select album...</option>
            {dropdownAlbums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.name}
              </option>
            ))}
          </select>

          {/* File input */}
          <label className="inline-flex items-center px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 cursor-pointer transition-colors shadow-sm">
            Browse Files
            <input
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              disabled={isUploading}
            />
          </label>

          <span className="text-xs text-gray-400">or drag & drop here</span>

          {/* Upload trigger */}
          {!isUploading && pendingCount > 0 && (
            <button
              onClick={handleUpload}
              disabled={!selectedAlbum}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Upload {pendingCount} file{pendingCount > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {pendingCount > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {pendingCount} file{pendingCount > 1 ? 's' : ''} selected, ready to upload
          </p>
        )}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        {/* Title / Breadcrumb */}
        {viewMode === 'albums' ? (
          <h2 className="text-lg font-semibold text-gray-900">
            Upload Photos or Add Album
          </h2>
        ) : (
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
            <button
              onClick={handleBackToAlbums}
              className="text-gray-400 hover:text-brand-600 transition-colors"
            >
              Albums
            </button>
            <ChevronRightIcon className="text-gray-300" />
            <span>{activeAlbumName}</span>
          </h2>
        )}

        <div className="flex items-center gap-3">
          {/* Layout toggle icons */}
          <button
            onClick={() => {
              if (viewMode !== 'albums') handleBackToAlbums();
              setAlbumLayout('list');
            }}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'albums' && albumLayout === 'list'
                ? 'text-brand-500 bg-brand-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="List view"
          >
            <ListIcon />
          </button>
          <button
            onClick={() => {
              if (viewMode !== 'albums') handleBackToAlbums();
              setAlbumLayout('grid');
            }}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'albums' && albumLayout === 'grid'
                ? 'text-brand-500 bg-brand-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Grid view"
          >
            <GridIcon />
          </button>
          <button
            onClick={() => setViewMode('import')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'import'
              ? 'text-brand-500 bg-brand-50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            title="Import from Drive"
          >
            <ImportIcon />
          </button>

          {/* Add Album button */}
          <button
            onClick={() => setShowAlbumForm(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <PlusIcon />
            Add Album
          </button>
        </div>
      </div>

      {/* Album form (if open) */}
      {showAlbumForm && (
        <div className="mb-4">
          <CreateAlbumForm
            eventId={eventId}
            onAlbumCreated={handleAlbumCreated}
            onCancel={() => setShowAlbumForm(false)}
          />
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'import' ? (
        // ─── Import View ────────────────────────────────────
        <ImportTab
          eventId={eventId}
          albums={initialAlbums}
          onImportComplete={() => { router.refresh(); setViewMode('photos'); }}
        />
      ) : viewMode === 'albums' ? (
        // ─── Albums View ─────────────────────────────────────
        initialAlbums.length === 0 ? (
          <AlbumsEmptyState onAddAlbum={() => setShowAlbumForm(true)} />
        ) : (
          <SortableAlbumList
            albums={initialAlbums}
            layout={albumLayout}
            eventId={eventId}
            eventHash={event.event_hash}
            totalPhotoCount={photoCount + videoCount}
            onAlbumClick={handleAlbumClick}
            onAllPhotosClick={handleAllPhotosClick}
            onCreateAlbum={() => setShowAlbumForm(true)}
          />
        )
      ) : (
        // ─── Photos View ─────────────────────────────────────
        <>
          <PhotoGrid
            media={filteredMedia}
            eventId={eventId}
            coverSelectionMode={coverSelectionMode}
            coverSelectedIds={coverSelectedIds}
            onCoverPhotoClick={coverSelectionMode ? handleCoverPhotoClick : undefined}
          />
          {/* Sentinel — always in DOM so observer stays attached */}
          <div
            ref={sentinelRef}
            style={{ height: '1px' }}
            className="pointer-events-none"
            aria-hidden="true"
          />
          {/* Loading / error indicators */}
          {hasMore && scrollLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <LoadingSpinner size="sm" className="text-gray-400" />
                Loading more photos...
              </div>
            </div>
          )}
          {scrollError && (
            <div className="flex items-center justify-center py-8">
              <button
                onClick={() => { failureCountRef.current = 0; setScrollError(null); loadMoreRef.current?.(); }}
                className="text-sm text-red-500 hover:text-red-600 underline"
              >
                {scrollError} Tap to retry.
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Wrapper with Suspense ───────────────────────────────────

export function PhotosPageClient(props: PhotosPageClientProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" variant="ring" />
      </div>
    }>
      <PhotosPageContent {...props} />
    </Suspense>
  );
}
