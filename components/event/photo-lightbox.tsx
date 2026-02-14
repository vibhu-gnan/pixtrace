'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { MediaItem } from '@/actions/media';

type LoadingPhase = 'thumbnail' | 'preview' | 'loading_original' | 'original';

// Cache loaded image URLs so navigating back is instant
// Persists across lightbox open/close within the same page
const imageCache = new Set<string>();

function isImageCached(url: string): boolean {
  return imageCache.has(url);
}

function cacheImage(url: string): void {
  imageCache.add(url);
}

// Preload an image into browser cache silently
function preloadImage(url: string): void {
  if (!url || isImageCached(url)) return;
  const img = new Image();
  img.src = url;
  img.onload = () => cacheImage(url);
}

interface PhotoLightboxProps {
  media: MediaItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoLightbox({ media, initialIndex, isOpen, onClose }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('thumbnail');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentPhoto = media[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < media.length - 1;

  // Reset state and timer when index changes or lightbox opens
  useEffect(() => {
    if (!isOpen) return;

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Check if preview is already cached — skip straight to it
    if (isImageCached(currentPhoto.full_url)) {
      setLoadingPhase('preview');
    } else {
      setLoadingPhase('thumbnail');
    }

    // Check if original is already cached — skip straight to it
    if (isImageCached(currentPhoto.original_url)) {
      setLoadingPhase('original');
      // Still preload adjacent photos
      preloadAdjacent();
      return;
    }

    // Preload the preview variant
    if (!isImageCached(currentPhoto.full_url)) {
      const previewImg = new Image();
      previewImg.src = currentPhoto.full_url;
      previewImg.onload = () => {
        cacheImage(currentPhoto.full_url);
        setLoadingPhase((current) => {
          if (current === 'thumbnail') return 'preview';
          return current;
        });
      };
    }

    // After 5 seconds, start loading the full original
    timerRef.current = setTimeout(() => {
      setLoadingPhase('loading_original');

      const origImg = new Image();
      origImg.src = currentPhoto.original_url;

      // Timeout: fall back to preview if original takes too long
      const loadTimeout = setTimeout(() => {
        if (origImg.complete) return;
        origImg.src = ''; // Cancel the load
        console.warn('Original image load timed out, staying on preview');
        setLoadingPhase('preview');
      }, 15000);

      origImg.onload = () => {
        clearTimeout(loadTimeout);
        cacheImage(currentPhoto.original_url);
        setLoadingPhase('original');
      };
      origImg.onerror = () => {
        clearTimeout(loadTimeout);
        console.error('Failed to load original image, staying on preview');
        setLoadingPhase('preview');
      };
    }, 5000);

    // Preload adjacent photos (prev/next preview variants)
    preloadAdjacent();

    function preloadAdjacent() {
      if (currentIndex > 0) {
        preloadImage(media[currentIndex - 1].full_url);
      }
      if (currentIndex < media.length - 1) {
        preloadImage(media[currentIndex + 1].full_url);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, isOpen, currentPhoto, media]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && canGoPrev) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && canGoNext) {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, canGoPrev, canGoNext]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevious = useCallback(() => {
    if (canGoPrev) {
      setCurrentIndex((i) => i - 1);
    }
  }, [canGoPrev]);

  const handleNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex((i) => i + 1);
    }
  }, [canGoNext]);

  if (!currentPhoto) return null;

  // Determine which image to display based on loading phase
  const displayImage =
    loadingPhase === 'thumbnail'
      ? currentPhoto.thumbnail_url
      : loadingPhase === 'preview' || loadingPhase === 'loading_original'
        ? currentPhoto.full_url
        : currentPhoto.original_url;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/95 z-50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close lightbox"
          >
            <CloseIcon className="text-white" />
          </button>



          {/* Previous button */}
          {canGoPrev && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeftIcon className="text-white" />
            </button>
          )}

          {/* Next button */}
          {canGoNext && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Next image"
            >
              <ChevronRightIcon className="text-white" />
            </button>
          )}

          {/* Main image display */}
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={displayImage}
              alt={currentPhoto.original_filename}
              className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${loadingPhase === 'thumbnail' ? 'opacity-70' : 'opacity-100'
                }`}
            />

            {/* Loading indicator during original load */}
            {loadingPhase === 'loading_original' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white text-sm">
                  Loading full resolution...
                </div>
              </div>
            )}
          </div>

          {/* Image filename and dimensions */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black/50 text-white text-xs max-w-md truncate">
            {currentPhoto.original_filename}
            {currentPhoto.width && currentPhoto.height && (
              <span className="ml-2 text-white/60">
                {currentPhoto.width} x {currentPhoto.height}
              </span>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Icon Components
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
