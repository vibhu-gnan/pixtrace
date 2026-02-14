'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { updateEventHero } from '@/actions/events';
import type { EventData } from '@/actions/events';
import type { MediaItem } from '@/actions/media';

// ─── Icons ───────────────────────────────────────────────────

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface CoverBarProps {
  event: EventData;
  media: MediaItem[];
  albums: { id: string; name: string }[];
  savedCoverPreviewUrl: string | null;
  coverSelectionMode: null | 'single' | 'slideshow-custom';
  onEnterSelectionMode: (mode: null | 'single' | 'slideshow-custom') => void;
  coverSingleSelectedId: string | null;
  onCoverSingleSelectedChange: (id: string | null) => void;
  coverSlideshowSelectedIds: Set<string>;
  onCoverSlideshowSelectedChange: (ids: Set<string>) => void;
}

// ─── Component ───────────────────────────────────────────────

export function CoverBar({
  event,
  media,
  savedCoverPreviewUrl,
  coverSelectionMode,
  onEnterSelectionMode,
  coverSingleSelectedId,
  onCoverSingleSelectedChange,
}: CoverBarProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const images = useMemo(() => media.filter(m => m.media_type === 'image'), [media]);

  const currentPreviewUrl = useMemo(() => {
    if (coverSingleSelectedId) {
      const found = images.find(m => m.id === coverSingleSelectedId);
      return found?.thumbnail_url ?? null;
    }
    return savedCoverPreviewUrl;
  }, [coverSingleSelectedId, images, savedCoverPreviewUrl]);

  const coverLabel = event.cover_media_id ? 'Selected Photo' : 'First Photo (default)';

  // ─── Handlers ──────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    const res = await updateEventHero(event.id, {
      coverMediaId: coverSingleSelectedId,
    });
    setSaving(false);

    if (res?.error) {
      setErrorMessage(res.error);
    } else {
      onEnterSelectionMode(null);
      setExpanded(false);
      router.refresh();
    }
  };

  const handleCollapse = () => {
    onEnterSelectionMode(null);
    setExpanded(false);
    setErrorMessage(null);
    onCoverSingleSelectedChange(event.cover_media_id ?? null);
  };

  // ─── Collapsed View ────────────────────────────────────────

  if (!expanded) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
          {currentPreviewUrl ? (
            <img src={currentPreviewUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ImageIcon />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">Gallery Cover</p>
          <p className="text-xs text-gray-500 truncate">{coverLabel}</p>
        </div>
        <button
          onClick={() => { setExpanded(true); setErrorMessage(null); }}
          className="px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-1"
        >
          Change
          <ChevronDownIcon />
        </button>
      </div>
    );
  }

  // ─── Expanded View ─────────────────────────────────────────

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Gallery Cover</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCollapse}
            className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Selection UI */}
      <div className="pt-2 border-t border-gray-100 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
            {coverSingleSelectedId ? (
              <img
                src={images.find(m => m.id === coverSingleSelectedId)?.thumbnail_url}
                alt="Selected"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <ImageIcon />
              </div>
            )}
          </div>
          <div className="flex-1">
            {coverSelectionMode === 'single' ? (
              <p className="text-sm text-amber-700 font-medium">
                Click a photo in the gallery below to select it as cover
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {coverSingleSelectedId ? 'Photo selected. Click below to change.' : 'Select a photo or leave empty to use the first photo.'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEnterSelectionMode(coverSelectionMode === 'single' ? null : 'single')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              coverSelectionMode === 'single'
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {coverSelectionMode === 'single' ? 'Cancel Selection' : 'Select from Gallery'}
          </button>
          {coverSingleSelectedId && (
            <button
              onClick={() => onCoverSingleSelectedChange(null)}
              className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear (use first photo)
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
