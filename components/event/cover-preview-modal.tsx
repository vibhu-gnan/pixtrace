'use client';

import { useState, useEffect, useCallback } from 'react';
import { HeroSlideshow } from '@/components/gallery/hero-slideshow';

// ─── Types ──────────────────────────────────────────────────

type ViewMode = 'desktop' | 'mobile';

interface CoverPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  heroMode: 'single' | 'slideshow' | 'auto';
  singlePhotoUrl: string | null;
  slideshowPhotos: Array<{ url: string; mediaId: string }>;
  mobileSlideshowPhotos: Array<{ url: string; mediaId: string }>;
  autoPhotos: Array<{ url: string; mediaId: string }>;
  intervalMs: number;
  eventName: string;
  eventDate: string | null;
  logoUrl: string | null;
}

// ─── Icons ──────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function SmartphoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────

export function CoverPreviewModal({
  isOpen,
  onClose,
  heroMode,
  singlePhotoUrl,
  slideshowPhotos,
  mobileSlideshowPhotos,
  autoPhotos,
  intervalMs,
  eventName,
  eventDate,
  logoUrl,
}: CoverPreviewModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');

  // Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Determine which slides to show based on mode and view
  const getSlides = () => {
    if (heroMode === 'slideshow') {
      if (viewMode === 'mobile' && mobileSlideshowPhotos.length >= 2) {
        return mobileSlideshowPhotos;
      }
      return slideshowPhotos;
    }
    if (heroMode === 'auto') {
      return autoPhotos;
    }
    return [];
  };

  const slides = getSlides();
  const hasSlideshow = slides.length >= 2;

  // First image URL for the static background
  const firstImageUrl =
    heroMode === 'single'
      ? singlePhotoUrl
      : slides[0]?.url ?? singlePhotoUrl;

  // Format date for display
  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // Mode label for the badge
  const modeLabel =
    heroMode === 'single'
      ? 'Single Photo'
      : heroMode === 'slideshow'
      ? `Slideshow (${slides.length} photos)`
      : 'Auto (first 5)';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal container */}
      <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Cover Preview
            </h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {modeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop / Mobile toggle */}
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'desktop'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MonitorIcon />
                Desktop
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'mobile'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <SmartphoneIcon />
                Mobile
              </button>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="bg-gray-950 flex items-center justify-center p-6 sm:p-8">
          <div
            className={`relative overflow-hidden rounded-lg shadow-lg transition-all duration-300 ${
              viewMode === 'desktop'
                ? 'w-full aspect-video'
                : 'w-[240px] sm:w-[280px] aspect-[9/16]'
            }`}
          >
            {/* Background image (static / first slide) */}
            {firstImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={firstImageUrl}
                alt="Cover preview"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <p className="text-gray-500 text-sm">No cover photo</p>
              </div>
            )}

            {/* Slideshow overlay */}
            {hasSlideshow && (
              <HeroSlideshow
                slides={slides}
                intervalMs={intervalMs}
              />
            )}

            {/* Gradient overlay */}
            <div
              className={`absolute inset-0 z-10 bg-gradient-to-b ${
                hasSlideshow
                  ? 'from-black/40 via-black/50 to-black/70'
                  : 'from-black/30 via-black/40 to-black/60'
              }`}
            />

            {/* Event info overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 px-4">
              {/* Logo */}
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={eventName}
                  className={`mb-2 object-contain drop-shadow-lg ${
                    viewMode === 'desktop'
                      ? 'h-10 sm:h-14 max-w-[60%]'
                      : 'h-8 sm:h-10 max-w-[70%]'
                  }`}
                />
              )}

              {/* Event name */}
              <h2
                className={`font-bold tracking-tight text-center uppercase drop-shadow-md leading-tight ${
                  viewMode === 'desktop'
                    ? 'text-xl sm:text-3xl'
                    : 'text-lg sm:text-xl'
                }`}
              >
                {eventName}
              </h2>

              {/* Date */}
              {formattedDate && (
                <p
                  className={`mt-1 text-white/80 tracking-wide ${
                    viewMode === 'desktop' ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'
                  }`}
                >
                  {formattedDate}
                </p>
              )}

              {/* Fake CTA */}
              <span
                className={`mt-3 inline-block border-2 border-white text-white font-semibold tracking-widest uppercase opacity-70 ${
                  viewMode === 'desktop'
                    ? 'px-4 py-1.5 text-[10px] sm:text-xs'
                    : 'px-3 py-1 text-[8px] sm:text-[10px]'
                }`}
              >
                View Gallery
              </span>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 text-center">
          <p className="text-xs text-gray-400">
            This is a preview of how your gallery cover will appear to visitors
          </p>
        </div>
      </div>
    </div>
  );
}
