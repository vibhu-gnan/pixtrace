'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { deleteMedia, deleteMultipleMedia } from '@/actions/media';
import type { MediaItem } from '@/actions/media';

// ─── Icons ───────────────────────────────────────────────────

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─── Delete Confirmation Modal ───────────────────────────────

interface DeleteConfirmModalProps {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirmModal({ count, onConfirm, onCancel, loading }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <WarningIcon className="text-red-600" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center">
          Delete {count} photo{count !== 1 ? 's' : ''}?
        </h3>
        <p className="text-sm text-gray-500 text-center">
          This will permanently delete {count === 1 ? 'this photo' : `these ${count} photos`} from the album and storage. This action cannot be undone.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Photo Grid ──────────────────────────────────────────────

interface PhotoGridProps {
  media: MediaItem[];
  eventId?: string;
}

export function PhotoGrid({ media, eventId }: PhotoGridProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === media.length) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(media.map((m) => m.id)));
    }
  }, [selectedIds.size, media]);

  const handleDeleteSelected = async () => {
    if (!eventId || selectedIds.size === 0) return;
    setDeleting(true);

    const ids = Array.from(selectedIds);
    if (ids.length === 1) {
      await deleteMedia(ids[0], eventId);
    } else {
      await deleteMultipleMedia(ids, eventId);
    }

    setDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    router.refresh();
  };

  if (media.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No photos uploaded yet</h3>
        <p className="text-sm text-gray-400">
          Drag and drop photos above or click &quot;Browse Files&quot; to start uploading
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Selection toolbar */}
      {eventId && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                } else {
                  setSelectionMode(true);
                }
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                selectionMode
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {selectionMode ? `${selectedIds.size} selected` : 'Select'}
            </button>
            {selectionMode && (
              <button
                onClick={handleSelectAll}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                {selectedIds.size === media.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          {selectionMode && selectedIds.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <TrashIcon />
              Delete ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
        {media.map((item) => (
          <PhotoThumbnail
            key={item.id}
            item={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            onSelect={() => toggleSelect(item.id)}
            onLongPress={() => {
              if (!selectionMode) {
                setSelectionMode(true);
                setSelectedIds(new Set([item.id]));
              }
            }}
          />
        ))}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          count={selectedIds.size}
          onConfirm={handleDeleteSelected}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={deleting}
        />
      )}
    </div>
  );
}

// ─── Photo Thumbnail ─────────────────────────────────────────

interface PhotoThumbnailProps {
  item: MediaItem;
  selectionMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}

function PhotoThumbnail({ item, selectionMode, selected, onSelect, onLongPress }: PhotoThumbnailProps) {
  const [loaded, setLoaded] = useState(false);

  const handleClick = () => {
    if (selectionMode) {
      onSelect();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onLongPress();
  };

  if (item.media_type === 'video') {
    return (
      <div
        className={`relative aspect-square rounded-lg bg-gray-900 flex items-center justify-center overflow-hidden cursor-pointer ${
          selected ? 'ring-2 ring-brand-500 ring-offset-1' : ''
        }`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <FilmIcon className="text-white/60" />
        <div className="absolute bottom-1 left-1 right-1">
          <p className="text-[10px] text-white/70 truncate px-1">{item.original_filename}</p>
        </div>
        {selectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              selected ? 'bg-brand-500 border-brand-500' : 'border-white/80 bg-black/30'
            }`}>
              {selected && <CheckIcon className="text-white" />}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-square rounded-lg overflow-hidden bg-gray-100 group cursor-pointer ${
        selected ? 'ring-2 ring-brand-500 ring-offset-1' : ''
      }`}
      style={
        item.blur_url
          ? { backgroundImage: `url(${item.blur_url})`, backgroundSize: 'cover' }
          : undefined
      }
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <img
        src={item.thumbnail_url}
        alt={item.original_filename}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className={`absolute inset-0 transition-colors ${
        selected ? 'bg-brand-500/20' : 'bg-black/0 group-hover:bg-black/10'
      }`} />
      {selectionMode && (
        <div className="absolute top-2 left-2 z-10">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-brand-500 border-brand-500' : 'border-white/80 bg-black/30'
          }`}>
            {selected && <CheckIcon className="text-white" />}
          </div>
        </div>
      )}
    </div>
  );
}
