'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { updateEventHero } from '@/actions/events';
import { uploadHeroImage } from '@/actions/upload';
import type { EventData } from '@/actions/events';
import type { MediaItem } from '@/actions/media';

// ─── Types ───────────────────────────────────────────────────

type CoverType = 'first' | 'single' | 'upload' | 'slideshow';

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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SlideshowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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
  albums,
  savedCoverPreviewUrl,
  coverSelectionMode,
  onEnterSelectionMode,
  coverSingleSelectedId,
  onCoverSingleSelectedChange,
  coverSlideshowSelectedIds,
  onCoverSlideshowSelectedChange,
}: CoverBarProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [coverType, setCoverType] = useState<CoverType>(event.cover_type || 'first');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localUploadedUrl, setLocalUploadedUrl] = useState<string | null>(null);
  const [localUploadedR2Key, setLocalUploadedR2Key] = useState<string | null>(event.cover_r2_key);

  // Slideshow sub-type
  const [slideshowType, setSlideshowType] = useState<'album' | 'custom'>(
    event.cover_slideshow_config?.type || 'album'
  );
  const [slideshowAlbumId, setSlideshowAlbumId] = useState<string | null>(
    event.cover_slideshow_config?.albumId || (albums[0]?.id ?? null)
  );

  // Images only (for lookups)
  const images = useMemo(() => media.filter(m => m.media_type === 'image'), [media]);

  // Current preview URL (what's displayed in the collapsed bar)
  const currentPreviewUrl = useMemo(() => {
    // If we have a local upload preview, use that
    if (coverType === 'upload' && localUploadedUrl) return localUploadedUrl;
    // If single mode and a photo is selected, show its thumbnail
    if (coverType === 'single' && coverSingleSelectedId) {
      const found = images.find(m => m.id === coverSingleSelectedId);
      return found?.thumbnail_url ?? null;
    }
    // Fall back to the server-computed saved preview
    return savedCoverPreviewUrl;
  }, [coverType, localUploadedUrl, coverSingleSelectedId, images, savedCoverPreviewUrl]);

  // Cover type label
  const coverTypeLabel = useMemo(() => {
    switch (coverType) {
      case 'first': return 'First Photo';
      case 'single': return 'Selected Photo';
      case 'upload': return 'Uploaded Cover';
      case 'slideshow': return slideshowType === 'album' ? 'Slideshow (Album)' : `Slideshow (${coverSlideshowSelectedIds.size} photos)`;
    }
  }, [coverType, slideshowType, coverSlideshowSelectedIds.size]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    const payload: {
      coverType: CoverType;
      coverMediaId?: string | null;
      coverR2Key?: string | null;
      coverSlideshowConfig?: { type: 'album' | 'custom'; albumId?: string; mediaIds?: string[] };
    } = { coverType };

    if (coverType === 'single') {
      payload.coverMediaId = coverSingleSelectedId;
    } else if (coverType === 'upload') {
      payload.coverR2Key = localUploadedR2Key;
    } else if (coverType === 'slideshow') {
      payload.coverSlideshowConfig = {
        type: slideshowType,
        albumId: slideshowType === 'album' ? slideshowAlbumId ?? undefined : undefined,
        mediaIds: slideshowType === 'custom' ? Array.from(coverSlideshowSelectedIds) : undefined,
      };
    }

    const res = await updateEventHero(event.id, payload);
    setSaving(false);

    if (res?.error) {
      setErrorMessage(res.error);
    } else {
      onEnterSelectionMode(null);
      setExpanded(false);
      router.refresh();
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    const res = await uploadHeroImage(event.id, formData);
    setUploading(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.r2Key && res.url) {
      setLocalUploadedR2Key(res.r2Key);
      setLocalUploadedUrl(res.url);
    }
  };

  const handleExpand = () => {
    setExpanded(true);
    setErrorMessage(null);
  };

  const handleCollapse = () => {
    onEnterSelectionMode(null);
    setExpanded(false);
    setErrorMessage(null);
    // Reset draft state to saved values
    setCoverType(event.cover_type || 'first');
    onCoverSingleSelectedChange(event.cover_media_id ?? null);
    onCoverSlideshowSelectedChange(new Set(event.cover_slideshow_config?.mediaIds || []));
    setLocalUploadedUrl(null);
    setLocalUploadedR2Key(event.cover_r2_key);
    setSlideshowType(event.cover_slideshow_config?.type || 'album');
    setSlideshowAlbumId(event.cover_slideshow_config?.albumId || (albums[0]?.id ?? null));
  };

  const handleCoverTypeChange = (type: CoverType) => {
    setCoverType(type);
    setErrorMessage(null);
    // Exit any active selection mode when switching types
    onEnterSelectionMode(null);
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
          <p className="text-xs text-gray-500 truncate">{coverTypeLabel}</p>
        </div>
        <button
          onClick={handleExpand}
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

      {/* Type selector — 4 buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { type: 'first' as CoverType, label: 'First Photo', desc: 'Default' },
          { type: 'single' as CoverType, label: 'Select Photo', desc: 'Pick from gallery' },
          { type: 'upload' as CoverType, label: 'Upload Cover', desc: 'Dedicated image' },
          { type: 'slideshow' as CoverType, label: 'Slideshow', desc: 'Rotating images' },
        ]).map(({ type, label, desc }) => (
          <button
            key={type}
            onClick={() => handleCoverTypeChange(type)}
            className={`p-3 rounded-lg border text-left transition-all ${
              coverType === type
                ? 'border-amber-400 ring-1 ring-amber-400 bg-amber-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-sm font-medium text-gray-900">{label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
          </button>
        ))}
      </div>

      {/* Type-specific configuration */}
      <div className="pt-2 border-t border-gray-100">
        {/* First Photo */}
        {coverType === 'first' && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
              {images[0]?.thumbnail_url ? (
                <img src={images[0].thumbnail_url} alt="First" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ImageIcon />
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              The first uploaded photo will be displayed as the gallery cover.
            </p>
          </div>
        )}

        {/* Single select */}
        {coverType === 'single' && (
          <div className="space-y-3">
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
                    {coverSingleSelectedId ? 'Photo selected. Click below to change.' : 'No photo selected yet.'}
                  </p>
                )}
              </div>
            </div>
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
          </div>
        )}

        {/* Upload */}
        {coverType === 'upload' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                {localUploadedUrl || (event.cover_type === 'upload' && savedCoverPreviewUrl) ? (
                  <img
                    src={localUploadedUrl || savedCoverPreviewUrl!}
                    alt="Uploaded cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <UploadIcon />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">
                  Upload a dedicated image for the cover. It won&apos;t appear in the gallery grid.
                </p>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <UploadIcon />
              {uploading ? 'Uploading...' : localUploadedUrl ? 'Replace Image' : 'Upload Image'}
            </button>
          </div>
        )}

        {/* Slideshow */}
        {coverType === 'slideshow' && (
          <div className="space-y-3">
            {/* Sub-type radio */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={slideshowType === 'album'}
                  onChange={() => {
                    setSlideshowType('album');
                    onEnterSelectionMode(null);
                  }}
                  className="accent-amber-500"
                />
                <span className="text-sm font-medium text-gray-700">Use Album</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={slideshowType === 'custom'}
                  onChange={() => setSlideshowType('custom')}
                  className="accent-amber-500"
                />
                <span className="text-sm font-medium text-gray-700">Select Photos</span>
              </label>
            </div>

            {/* Album dropdown */}
            {slideshowType === 'album' && (
              <select
                value={slideshowAlbumId || ''}
                onChange={(e) => setSlideshowAlbumId(e.target.value)}
                className="block w-full max-w-xs rounded-lg border-gray-300 text-sm focus:border-amber-500 focus:ring-amber-500"
              >
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}

            {/* Custom multi-select */}
            {slideshowType === 'custom' && (
              <div className="space-y-2">
                {coverSelectionMode === 'slideshow-custom' ? (
                  <>
                    <p className="text-sm text-amber-700 font-medium">
                      Click photos in the gallery below to add or remove. {coverSlideshowSelectedIds.size} selected.
                    </p>
                    {coverSlideshowSelectedIds.size > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {Array.from(coverSlideshowSelectedIds).slice(0, 10).map(id => {
                          const m = images.find(item => item.id === id);
                          return m ? (
                            <div key={id} className="w-8 h-8 rounded overflow-hidden bg-gray-100">
                              <img src={m.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : null;
                        })}
                        {coverSlideshowSelectedIds.size > 10 && (
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                            +{coverSlideshowSelectedIds.size - 10}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => onEnterSelectionMode(null)}
                      className="px-3 py-1.5 text-sm font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors"
                    >
                      Done Selecting
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onEnterSelectionMode('slideshow-custom')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <SlideshowIcon />
                    Select Photos ({coverSlideshowSelectedIds.size})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
