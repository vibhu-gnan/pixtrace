'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { updateEventHero } from '@/actions/events';
import type { EventData } from '@/actions/events';
import type { MediaItem } from '@/actions/media';

// ─── Types ──────────────────────────────────────────────────

type HeroMode = 'single' | 'slideshow' | 'auto';

const INTERVAL_OPTIONS = [
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
  { label: '8s', value: 8000 },
];

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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface CoverBarProps {
  event: EventData;
  media: MediaItem[];
  albums: { id: string; name: string }[];
  savedCoverPreviewUrl: string | null;
  coverSelectionMode: null | 'single' | 'slideshow-custom' | 'slideshow-mobile';
  onEnterSelectionMode: (mode: null | 'single' | 'slideshow-custom' | 'slideshow-mobile') => void;
  coverSingleSelectedId: string | null;
  onCoverSingleSelectedChange: (id: string | null) => void;
  coverSlideshowSelectedIds: Set<string>;
  onCoverSlideshowSelectedChange: (ids: Set<string>) => void;
  coverMobileSlideshowSelectedIds: Set<string>;
  onCoverMobileSlideshowSelectedChange: (ids: Set<string>) => void;
  heroMode: HeroMode;
  onHeroModeChange: (mode: HeroMode) => void;
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
  coverSlideshowSelectedIds,
  onCoverSlideshowSelectedChange,
  coverMobileSlideshowSelectedIds,
  onCoverMobileSlideshowSelectedChange,
  heroMode,
  onHeroModeChange,
}: CoverBarProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intervalMs, setIntervalMs] = useState<number>(
    (event.theme as any)?.hero?.intervalMs ?? 5000
  );

  const images = useMemo(() => media.filter(m => m.media_type === 'image'), [media]);

  const currentPreviewUrl = useMemo(() => {
    if (heroMode === 'single' && coverSingleSelectedId) {
      const found = images.find(m => m.id === coverSingleSelectedId);
      return found?.thumbnail_url ?? null;
    }
    return savedCoverPreviewUrl;
  }, [heroMode, coverSingleSelectedId, images, savedCoverPreviewUrl]);

  // Ordered arrays for desktop and mobile slideshow
  const slideshowOrderedIds = useMemo(() => [...coverSlideshowSelectedIds], [coverSlideshowSelectedIds]);
  const mobileOrderedIds = useMemo(() => [...coverMobileSlideshowSelectedIds], [coverMobileSlideshowSelectedIds]);

  // Collapsed label
  const coverLabel = useMemo(() => {
    if (heroMode === 'slideshow') {
      const mobileNote = coverMobileSlideshowSelectedIds.size > 0 ? ` + ${coverMobileSlideshowSelectedIds.size} mobile` : '';
      return `Slideshow (${coverSlideshowSelectedIds.size} desktop${mobileNote})`;
    }
    if (heroMode === 'auto') return 'Auto (first 5 photos)';
    return event.cover_media_id ? 'Selected Photo' : 'First Photo (default)';
  }, [heroMode, coverSlideshowSelectedIds.size, coverMobileSlideshowSelectedIds.size, event.cover_media_id]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);

    if (heroMode === 'slideshow' && coverSlideshowSelectedIds.size < 2) {
      setErrorMessage('Select at least 2 photos for a slideshow.');
      setSaving(false);
      return;
    }

    const res = await updateEventHero(event.id, {
      coverMediaId: heroMode === 'single' ? coverSingleSelectedId : undefined,
      heroMode,
      slideshowMediaIds: heroMode === 'slideshow' ? slideshowOrderedIds : undefined,
      mobileSlideshowMediaIds: heroMode === 'slideshow' ? mobileOrderedIds : undefined,
      intervalMs: heroMode !== 'single' ? intervalMs : undefined,
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
    // Reset to saved state
    onCoverSingleSelectedChange(event.cover_media_id ?? null);
    onHeroModeChange(((event.theme as any)?.hero?.mode as HeroMode) ?? 'single');
    const savedIds = (event.theme as any)?.hero?.slideshowMediaIds;
    onCoverSlideshowSelectedChange(new Set(savedIds ?? []));
    const savedMobileIds = (event.theme as any)?.hero?.mobileSlideshowMediaIds;
    onCoverMobileSlideshowSelectedChange(new Set(savedMobileIds ?? []));
    setIntervalMs((event.theme as any)?.hero?.intervalMs ?? 5000);
  };

  const handleModeChange = (mode: HeroMode) => {
    onHeroModeChange(mode);
    if (mode === 'single') {
      onEnterSelectionMode('single');
    } else if (mode === 'slideshow') {
      onEnterSelectionMode('slideshow-custom');
    } else {
      onEnterSelectionMode(null);
    }
  };

  const handleRemoveFromSlideshow = (mediaId: string) => {
    const next = new Set(coverSlideshowSelectedIds);
    next.delete(mediaId);
    onCoverSlideshowSelectedChange(next);
  };

  const handleRemoveFromMobileSlideshow = (mediaId: string) => {
    const next = new Set(coverMobileSlideshowSelectedIds);
    next.delete(mediaId);
    onCoverMobileSlideshowSelectedChange(next);
  };

  // ─── Collapsed View ────────────────────────────────────────

  if (!expanded) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
          {currentPreviewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentPreviewUrl} alt="Cover" className="w-full h-full object-cover" />
            </>
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

      {/* Mode Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'single' as HeroMode, label: 'Single Photo' },
          { key: 'slideshow' as HeroMode, label: 'Slideshow' },
          { key: 'auto' as HeroMode, label: 'Auto (first 5)' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => handleModeChange(tab.key)}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${heroMode === tab.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mode-specific content */}
      <div className="pt-2 border-t border-gray-100 space-y-3">
        {heroMode === 'single' && (
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-9 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                {coverSingleSelectedId ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images.find(m => m.id === coverSingleSelectedId)?.thumbnail_url}
                      alt="Selected"
                      className="w-full h-full object-cover"
                    />
                  </>
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
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${coverSelectionMode === 'single'
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
          </>
        )}

        {heroMode === 'slideshow' && (
          <>
            {/* ── Desktop slideshow ─────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🖥 Desktop / Landscape</span>
                  <span className="text-xs text-gray-400">({coverSlideshowSelectedIds.size} photos)</span>
                </div>
                <button
                  onClick={() => onEnterSelectionMode(coverSelectionMode === 'slideshow-custom' ? null : 'slideshow-custom')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${coverSelectionMode === 'slideshow-custom'
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {coverSelectionMode === 'slideshow-custom' ? 'Done' : 'Select'}
                </button>
              </div>
              {coverSelectionMode === 'slideshow-custom' && (
                <p className="text-xs text-amber-700">Click photos below to add/remove</p>
              )}
              {slideshowOrderedIds.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {slideshowOrderedIds.map((id, index) => {
                    const item = images.find(m => m.id === id);
                    if (!item) return null;
                    return (
                      <div key={id} className="relative flex-shrink-0 w-16 h-12 rounded-md overflow-hidden bg-gray-100 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.thumbnail_url} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-0.5 left-0.5 bg-black/70 text-white text-[10px] font-bold px-1 rounded">{index + 1}</span>
                        <button onClick={() => handleRemoveFromSlideshow(id)} className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Mobile slideshow ──────────────────────────── */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">📱 Mobile / Portrait</span>
                  <span className="text-xs text-gray-400">
                    {coverMobileSlideshowSelectedIds.size > 0
                      ? `(${coverMobileSlideshowSelectedIds.size} photos)`
                      : '(uses desktop if empty)'}
                  </span>
                </div>
                <button
                  onClick={() => onEnterSelectionMode(coverSelectionMode === 'slideshow-mobile' ? null : 'slideshow-mobile')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${coverSelectionMode === 'slideshow-mobile'
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {coverSelectionMode === 'slideshow-mobile' ? 'Done' : 'Select'}
                </button>
              </div>
              {coverSelectionMode === 'slideshow-mobile' && (
                <p className="text-xs text-blue-700">Click photos below to add/remove (portrait photos work best)</p>
              )}
              {mobileOrderedIds.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {mobileOrderedIds.map((id, index) => {
                    const item = images.find(m => m.id === id);
                    if (!item) return null;
                    return (
                      <div key={id} className="relative flex-shrink-0 w-10 h-14 rounded-md overflow-hidden bg-gray-100 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.thumbnail_url} alt={`Mobile slide ${index + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-0.5 left-0.5 bg-black/70 text-white text-[10px] font-bold px-1 rounded">{index + 1}</span>
                        <button onClick={() => handleRemoveFromMobileSlideshow(id)} className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => { onCoverMobileSlideshowSelectedChange(new Set()); }}
                    className="flex-shrink-0 w-10 h-14 rounded-md border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 hover:bg-gray-50"
                    title="Clear mobile slideshow (will use desktop)"
                  >
                    <XIcon />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No mobile photos selected — desktop slideshow will be used on all devices</p>
              )}
            </div>

            {/* Interval selector */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Change every:</span>
              <div className="flex gap-1">
                {INTERVAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setIntervalMs(opt.value)}
                    className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${intervalMs === opt.value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {heroMode === 'auto' && (
          <div className="flex items-center gap-3 py-2">
            <div className="flex -space-x-2">
              {images.slice(0, 5).map((img, i) => (
                <div key={img.id} className="w-8 h-8 rounded-full overflow-hidden border-2 border-white bg-gray-100" style={{ zIndex: 5 - i }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.thumbnail_url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              Will automatically cycle through the first 5 photos in your event
            </p>
          </div>
        )}

        {/* Interval selector for auto mode too */}
        {heroMode === 'auto' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Change every:</span>
            <div className="flex gap-1">
              {INTERVAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setIntervalMs(opt.value)}
                  className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${intervalMs === opt.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
