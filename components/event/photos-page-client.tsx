'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUploadStore } from '@/lib/upload/upload-manager';
import { UploadBanner } from './upload-banner';
import { PhotoGrid } from './photo-grid';
import { StatsBar } from './stats-bar';
import { AlbumCard } from './album-card';
import { CreateAlbumCard } from './create-album-card';
import { AlbumsEmptyState } from './albums-empty-state';
import { CreateAlbumForm } from '@/components/dashboard/create-album-form';
import type { MediaItem } from '@/actions/media';
import type { AlbumData } from '@/actions/albums';

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

type ViewMode = 'albums' | 'photos';

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
}

function PhotosPageContent({ eventId, eventName, media, albums: initialAlbums }: PhotosPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const albumIdFromUrl = searchParams.get('album');

  const { items, isUploading, addFiles, startUpload } = useUploadStore();

  // ─── State ───────────────────────────────────────────────
  const [dropdownAlbums, setDropdownAlbums] = useState(initialAlbums.map((a) => ({ id: a.id, name: a.name })));
  const [selectedAlbum, setSelectedAlbum] = useState(albumIdFromUrl || initialAlbums[0]?.id || '');
  const [dragActive, setDragActive] = useState(false);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [albumRefreshKey, setAlbumRefreshKey] = useState(0);
  // Default to 'photos' view if there are photos, otherwise show albums
  const [viewMode, setViewMode] = useState<ViewMode>(media.length > 0 ? 'photos' : 'albums');
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);

  // ─── Computed Values ─────────────────────────────────────
  const photoCount = useMemo(() => media.filter((m) => m.media_type === 'image').length, [media]);
  const videoCount = useMemo(() => media.filter((m) => m.media_type === 'video').length, [media]);
  const albumCount = initialAlbums.length;

  // Build a map of albumId → first image thumbnail URL for covers
  const albumCoverMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of media) {
      if (item.media_type === 'image' && item.thumbnail_url && !map.has(item.album_id)) {
        map.set(item.album_id, item.thumbnail_url);
      }
    }
    return map;
  }, [media]);

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
      .catch(() => {});
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

  // Auto-refresh page after uploads complete
  useEffect(() => {
    if (!isUploading && items.some((i) => i.status === 'done')) {
      const timer = setTimeout(() => router.refresh(), 500); // Reduced from 1500ms - cache already revalidated server-side
      return () => clearTimeout(timer);
    }
  }, [isUploading, items, router])

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

  const handleAlbumClick = useCallback((albumId: string) => {
    setActiveAlbumId(albumId);
    setSelectedAlbum(albumId);
    setViewMode('photos');
  }, []);

  const handleBackToAlbums = useCallback(() => {
    setViewMode('albums');
    setActiveAlbumId(null);
  }, []);

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  // ─── Render ──────────────────────────────────────────────

  return (
    <div>
      {/* Upload Banner — shows during/after uploads */}
      <UploadBanner eventName={eventName} />

      {/* Stats bar */}
      <StatsBar albumCount={albumCount} photoCount={photoCount} videoCount={videoCount} />

      {/* Upload drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors mb-6 ${
          dragActive
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
          {/* View toggle icons */}
          <button
            onClick={handleBackToAlbums}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'albums'
                ? 'text-brand-500 bg-brand-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Albums view"
          >
            <ListIcon />
          </button>
          <button
            onClick={() => setViewMode('photos')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'photos'
                ? 'text-brand-500 bg-brand-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Photos view"
          >
            <GridIcon />
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
      {viewMode === 'albums' ? (
        // ─── Albums View ─────────────────────────────────────
        initialAlbums.length === 0 ? (
          <AlbumsEmptyState onAddAlbum={() => setShowAlbumForm(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {initialAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                coverUrl={albumCoverMap.get(album.id) || null}
                onClick={() => handleAlbumClick(album.id)}
              />
            ))}
            <CreateAlbumCard onCreateAlbum={() => setShowAlbumForm(true)} />
          </div>
        )
      ) : (
        // ─── Photos View ─────────────────────────────────────
        <PhotoGrid media={filteredMedia} eventId={eventId} />
      )}
    </div>
  );
}

// ─── Wrapper with Suspense ───────────────────────────────────

export function PhotosPageClient(props: PhotosPageClientProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <PhotosPageContent {...props} />
    </Suspense>
  );
}
