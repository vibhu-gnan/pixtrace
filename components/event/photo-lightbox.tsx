'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { MediaItem } from '@/actions/media';

type LoadingPhase = 'thumbnail' | 'preview' | 'loading_original' | 'original';

// Cache loaded image URLs so navigating back is instant
// Persists across lightbox open/close within the same page
// Bounded FIFO cache to prevent unbounded memory growth
const IMAGE_CACHE_MAX = 200;
const imageCacheList: string[] = [];
const imageCacheSet = new Set<string>();

function isImageCached(url: string): boolean {
  return imageCacheSet.has(url);
}

function cacheImage(url: string): void {
  if (imageCacheSet.has(url)) return;
  if (imageCacheList.length >= IMAGE_CACHE_MAX) {
    const evicted = imageCacheList.shift()!;
    imageCacheSet.delete(evicted);
  }
  imageCacheList.push(url);
  imageCacheSet.add(url);
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
  eventHash?: string;
  allowDownload?: boolean;
}

const SWIPE_THRESHOLD = 50;
const LIGHTBOX_STATE_KEY = 'pixtrace-lightbox';

export function PhotoLightbox({ media, initialIndex, isOpen, onClose, eventHash, allowDownload = true }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('thumbnail');
  const [linkCopied, setLinkCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const pushedStateRef = useRef(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // History: back button (browser/phone) closes lightbox instead of leaving page
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.history) return;
    if (pushedStateRef.current) return;

    const state = { [LIGHTBOX_STATE_KEY]: true };
    window.history.pushState(state, '', window.location.href);
    pushedStateRef.current = true;

    const handlePopState = () => {
      pushedStateRef.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

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

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSharePhoto = useCallback(async () => {
    if (!currentPhoto) return;
    const baseUrl = eventHash
      ? `${window.location.origin}/gallery/${eventHash}`
      : window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?photo=${currentPhoto.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: currentPhoto.original_filename, url: shareUrl });
        return;
      } catch { /* cancelled or unsupported */ }
    }

    // Fallback: copy to clipboard
    try { await navigator.clipboard.writeText(shareUrl); }
    catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setLinkCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setLinkCopied(false), 2000);
  }, [currentPhoto, eventHash]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Reset download states when photo changes
  useEffect(() => {
    setIsDownloading(false);
    setDownloadSuccess(false);
  }, [currentIndex]);

  const handleDownload = useCallback(async () => {
    if (!currentPhoto || isDownloading) return;

    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      // Use the proxy route to avoid CORS issues and force download with correct filename
      const downloadUrl = `/api/download?url=${encodeURIComponent(currentPhoto.original_url)}&filename=${encodeURIComponent(currentPhoto.original_filename)}`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = currentPhoto.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(currentPhoto.original_url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  }, [currentPhoto, isDownloading]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && canGoPrev) {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, canGoPrev, canGoNext, handlePrevious, handleNext, handleClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const endX = e.changedTouches[0].clientX;
      const deltaX = touchStartX.current - endX;
      touchStartX.current = null;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
      if (deltaX > 0 && canGoNext) handleNext();
      else if (deltaX < 0 && canGoPrev) handlePrevious();
    },
    [canGoNext, canGoPrev, handleNext, handlePrevious]
  );

  if (!currentPhoto) return null;

  // Determine which image to display based on loading phase
  const displayImage =
    loadingPhase === 'thumbnail'
      ? currentPhoto.thumbnail_url
      : loadingPhase === 'preview' || loadingPhase === 'loading_original'
        ? currentPhoto.full_url
        : currentPhoto.original_url;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/95 z-50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          {/* Top-right buttons */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {allowDownload && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${downloadSuccess ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                  } ${isDownloading ? 'cursor-wait opacity-80' : ''}`}
                aria-label="Download photo"
                title="Download original"
              >
                {isDownloading ? (
                  <SpinnerIcon className="animate-spin text-white" />
                ) : downloadSuccess ? (
                  <CheckIcon className="text-white" />
                ) : (
                  <DownloadIcon className="text-white" />
                )}
              </button>
            )}
            <button
              onClick={handleSharePhoto}
              className="relative w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Share photo"
            >
              <ShareIcon className="text-white" />
              {linkCopied && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white bg-black/70 px-2 py-1 rounded whitespace-nowrap">
                  Link copied
                </span>
              )}
            </button>
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close lightbox"
            >
              <CloseIcon className="text-white" />
            </button>
          </div>



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

          {/* Main image display — touch area for swipe; click empty sides to close */}
          <div
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center touch-none cursor-default"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <img
              src={displayImage}
              alt={currentPhoto.original_filename}
              className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${loadingPhase === 'thumbnail' ? 'opacity-70' : 'opacity-100'
                }`}
            />

            {/* Original load happens silently in background */}
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

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
