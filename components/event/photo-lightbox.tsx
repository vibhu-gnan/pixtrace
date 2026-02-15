'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { MediaItem } from '@/actions/media';

type LoadingPhase = 'thumbnail' | 'preview' | 'loading_original' | 'original';

// ─── Image Cache ────────────────────────────────────────────
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

function preloadImage(url: string): void {
  if (!url || isImageCached(url)) return;
  const img = new Image();
  img.src = url;
  img.onload = () => cacheImage(url);
}

// ─── Zoom Hook ──────────────────────────────────────────────

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_TIMEOUT = 300;

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function getDistance(t1: Touch, t2: Touch) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function getMidpoint(t1: Touch, t2: Touch) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

function useImageZoom() {
  // Use a single ref object for all mutable gesture state to avoid stale closures entirely.
  // React state is only used for values that must trigger a re-render.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef({
    scale: 1,
    posX: 0,
    posY: 0,
    // pinch
    lastPinchDist: null as number | null,
    lastPinchScale: 1,
    lastPinchMidX: 0,
    lastPinchMidY: 0,
    pinchOriginX: 0,  // posX at pinch start
    pinchOriginY: 0,  // posY at pinch start
    isPinching: false,
    // pan
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    isPanning: false,
    // double-tap
    lastTapTime: 0,
    // mouse drag
    isMouseDragging: false,
    mousePanStartX: 0,
    mousePanStartY: 0,
    mousePanOriginX: 0,
    mousePanOriginY: 0,
  });

  // Only these drive re-renders
  const [renderScale, setRenderScale] = useState(1);
  const [renderPos, setRenderPos] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  const isZoomed = renderScale > 1.05;

  // Commit gesture state → React state (triggers re-render)
  const commit = useCallback((animate: boolean) => {
    const g = gestureRef.current;
    setRenderScale(g.scale);
    setRenderPos({ x: g.posX, y: g.posY });
    setIsAnimating(animate);
  }, []);

  // Compute pan bounds from actual container & scale
  const getBounds = useCallback((s: number) => {
    const el = containerRef.current;
    if (!el || s <= 1) return { maxX: 0, maxY: 0 };
    const rect = el.getBoundingClientRect();
    // How many extra pixels the scaled image overflows on each axis
    const maxX = Math.max(0, (rect.width * (s - 1)) / (2 * s));
    const maxY = Math.max(0, (rect.height * (s - 1)) / (2 * s));
    return { maxX, maxY };
  }, []);

  const constrainPos = useCallback((x: number, y: number, s: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const { maxX, maxY } = getBounds(s);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, [getBounds]);

  const resetZoom = useCallback(() => {
    const g = gestureRef.current;
    g.scale = 1;
    g.posX = 0;
    g.posY = 0;
    g.lastPinchDist = null;
    g.isPinching = false;
    g.isPanning = false;
    g.isMouseDragging = false;
    commit(true);
  }, [commit]);

  // ─── Non-passive native event listeners ─────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // ── Wheel (desktop zoom) ──────────────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const g = gestureRef.current;
      const factor = e.deltaMode === 1 ? 30 : 1; // line vs px
      const delta = -(e.deltaY * factor) * 0.005;
      const newScale = clamp(g.scale * (1 + delta), MIN_SCALE, MAX_SCALE);

      if (newScale <= 1) {
        g.scale = 1; g.posX = 0; g.posY = 0;
      } else {
        // Zoom toward cursor position
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - rect.width / 2;
        const cursorY = e.clientY - rect.top - rect.height / 2;
        const scaleDelta = newScale / g.scale;
        const newPosX = cursorX - scaleDelta * (cursorX - g.posX * g.scale) / newScale;
        const newPosY = cursorY - scaleDelta * (cursorY - g.posY * g.scale) / newScale;
        g.scale = newScale;
        const clamped = constrainPos(newPosX, newPosY, newScale);
        g.posX = clamped.x;
        g.posY = clamped.y;
      }
      commit(false);
    };

    // ── Touch ─────────────────────────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      const g = gestureRef.current;

      if (e.touches.length === 2) {
        e.preventDefault();
        g.isPinching = true;
        g.isPanning = false;
        g.lastPinchDist = getDistance(e.touches[0], e.touches[1]);
        g.lastPinchScale = g.scale;
        g.pinchOriginX = g.posX;
        g.pinchOriginY = g.posY;
        const mid = getMidpoint(e.touches[0], e.touches[1]);
        g.lastPinchMidX = mid.x;
        g.lastPinchMidY = mid.y;
      } else if (e.touches.length === 1) {
        e.preventDefault();
        const now = Date.now();
        const isDoubleTap = (now - g.lastTapTime) < DOUBLE_TAP_TIMEOUT;

        if (isDoubleTap) {
          g.lastTapTime = 0;
          if (g.scale > 1.05) {
            g.scale = 1; g.posX = 0; g.posY = 0;
          } else {
            const rect = el.getBoundingClientRect();
            const tapX = e.touches[0].clientX - rect.left - rect.width / 2;
            const tapY = e.touches[0].clientY - rect.top - rect.height / 2;
            const s = DOUBLE_TAP_SCALE;
            const clamped = constrainPos(
              -(tapX * (s - 1)) / s,
              -(tapY * (s - 1)) / s,
              s
            );
            g.scale = s;
            g.posX = clamped.x;
            g.posY = clamped.y;
          }
          commit(true);
          return;
        }

        g.lastTapTime = now;

        if (g.scale > 1.05) {
          g.isPanning = true;
          g.panStartX = e.touches[0].clientX;
          g.panStartY = e.touches[0].clientY;
          g.panOriginX = g.posX;
          g.panOriginY = g.posY;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;

      if (e.touches.length === 2 && g.isPinching && g.lastPinchDist !== null) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const newScale = clamp(g.lastPinchScale * (dist / g.lastPinchDist), MIN_SCALE, MAX_SCALE);

        if (newScale <= 1) {
          g.scale = 1; g.posX = 0; g.posY = 0;
        } else {
          // Anchor zoom to pinch midpoint
          const rect = el.getBoundingClientRect();
          const mid = getMidpoint(e.touches[0], e.touches[1]);
          const anchorX = g.lastPinchMidX - rect.left - rect.width / 2;
          const anchorY = g.lastPinchMidY - rect.top - rect.height / 2;
          const scaleDelta = newScale / g.lastPinchScale;
          const newPosX = anchorX - scaleDelta * (anchorX - g.pinchOriginX * g.lastPinchScale) / newScale;
          const newPosY = anchorY - scaleDelta * (anchorY - g.pinchOriginY * g.lastPinchScale) / newScale;
          // Also pan with midpoint drift
          const driftX = (mid.x - g.lastPinchMidX) / newScale;
          const driftY = (mid.y - g.lastPinchMidY) / newScale;
          g.scale = newScale;
          const clamped = constrainPos(newPosX + driftX, newPosY + driftY, newScale);
          g.posX = clamped.x;
          g.posY = clamped.y;
        }
        commit(false);
      } else if (e.touches.length === 1 && g.isPanning) {
        e.preventDefault();
        const dx = (e.touches[0].clientX - g.panStartX) / g.scale;
        const dy = (e.touches[0].clientY - g.panStartY) / g.scale;
        const clamped = constrainPos(g.panOriginX + dx, g.panOriginY + dy, g.scale);
        g.posX = clamped.x;
        g.posY = clamped.y;
        commit(false);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const g = gestureRef.current;

      if (e.touches.length === 0) {
        g.isPinching = false;
        g.isPanning = false;
        g.lastPinchDist = null;
        // Snap back to 1 if nearly at base scale
        if (g.scale < 1.08) {
          g.scale = 1; g.posX = 0; g.posY = 0;
          commit(true);
        }
      } else if (e.touches.length === 1 && g.isPinching) {
        // Finger lifted during pinch — transition to pan mode
        g.isPinching = false;
        if (g.scale > 1.05) {
          g.isPanning = true;
          g.panStartX = e.touches[0].clientX;
          g.panStartY = e.touches[0].clientY;
          g.panOriginX = g.posX;
          g.panOriginY = g.posY;
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [commit, constrainPos]);

  // ─── Mouse drag (desktop pan when zoomed) ───────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const g = gestureRef.current;
    if (g.scale > 1.05) {
      resetZoom();
    } else {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clickX = e.clientX - rect.left - rect.width / 2;
      const clickY = e.clientY - rect.top - rect.height / 2;
      const s = DOUBLE_TAP_SCALE;
      const clamped = constrainPos(-(clickX * (s - 1)) / s, -(clickY * (s - 1)) / s, s);
      g.scale = s;
      g.posX = clamped.x;
      g.posY = clamped.y;
      commit(true);
    }
  }, [resetZoom, constrainPos, commit]);

  // Track mouse drag listeners so we can clean up on unmount
  const mouseDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { mouseDragCleanupRef.current?.(); };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const g = gestureRef.current;
    if (g.scale <= 1.05) return;
    e.preventDefault();
    g.isMouseDragging = true;
    g.mousePanStartX = e.clientX;
    g.mousePanStartY = e.clientY;
    g.mousePanOriginX = g.posX;
    g.mousePanOriginY = g.posY;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - g.mousePanStartX) / g.scale;
      const dy = (ev.clientY - g.mousePanStartY) / g.scale;
      const clamped = constrainPos(g.mousePanOriginX + dx, g.mousePanOriginY + dy, g.scale);
      g.posX = clamped.x;
      g.posY = clamped.y;
      commit(false);
    };

    const cleanup = () => {
      g.isMouseDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', cleanup);
      mouseDragCleanupRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', cleanup);
    mouseDragCleanupRef.current = cleanup;
  }, [constrainPos, commit]);

  const imageStyle: React.CSSProperties = {
    transform: `scale(${renderScale}) translate(${renderPos.x}px, ${renderPos.y}px)`,
    transition: isAnimating ? 'transform 0.2s ease-out' : 'none',
    transformOrigin: 'center center',
    willChange: 'transform',
  };

  return {
    isZoomed,
    resetZoom,
    imageStyle,
    containerRef,
    handlers: {
      onDoubleClick: handleDoubleClick,
      onMouseDown: handleMouseDown,
    },
    // Expose for swipe logic
    isPinching: () => gestureRef.current.isPinching,
    isPanning: () => gestureRef.current.isPanning,
  };
}

// ─── Lightbox Component ─────────────────────────────────────

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
  const touchStartY = useRef<number | null>(null);
  const pushedStateRef = useRef(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zoom = useImageZoom();

  const currentPhoto = media[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < media.length - 1;

  // Reset zoom when navigating between photos
  useEffect(() => {
    zoom.resetZoom();
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state and timer when index changes or lightbox opens
  useEffect(() => {
    if (!isOpen) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (isImageCached(currentPhoto.full_url)) {
      setLoadingPhase('preview');
    } else {
      setLoadingPhase('thumbnail');
    }

    if (isImageCached(currentPhoto.original_url)) {
      setLoadingPhase('original');
      preloadAdjacent();
      return;
    }

    if (!isImageCached(currentPhoto.full_url)) {
      const previewImg = new Image();
      previewImg.src = currentPhoto.full_url;
      previewImg.onload = () => {
        cacheImage(currentPhoto.full_url);
        setLoadingPhase((current) => current === 'thumbnail' ? 'preview' : current);
      };
    }

    timerRef.current = setTimeout(() => {
      setLoadingPhase('loading_original');
      const origImg = new Image();
      origImg.src = currentPhoto.original_url;

      const loadTimeout = setTimeout(() => {
        if (origImg.complete) return;
        origImg.src = '';
        setLoadingPhase('preview');
      }, 15000);

      origImg.onload = () => {
        clearTimeout(loadTimeout);
        cacheImage(currentPhoto.original_url);
        setLoadingPhase('original');
      };
      origImg.onerror = () => {
        clearTimeout(loadTimeout);
        setLoadingPhase('preview');
      };
    }, 5000);

    preloadAdjacent();

    function preloadAdjacent() {
      if (currentIndex > 0) preloadImage(media[currentIndex - 1].full_url);
      if (currentIndex < media.length - 1) preloadImage(media[currentIndex + 1].full_url);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, isOpen, currentPhoto, media]);

  // History: back button closes lightbox
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.history) return;
    if (pushedStateRef.current) return;

    window.history.pushState({ [LIGHTBOX_STATE_KEY]: true }, '', window.location.href);
    pushedStateRef.current = true;

    const handlePopState = () => {
      pushedStateRef.current = false;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, onClose]);

  const handlePrevious = useCallback(() => {
    if (canGoPrev) setCurrentIndex((i) => i - 1);
  }, [canGoPrev]);

  const handleNext = useCallback(() => {
    if (canGoNext) setCurrentIndex((i) => i + 1);
  }, [canGoNext]);

  const handleClose = useCallback(() => {
    if (pushedStateRef.current) {
      pushedStateRef.current = false;
      try { window.history.back(); } catch { /* SSR guard */ }
    }
    onClose();
  }, [onClose]);

  const handleSharePhoto = useCallback(async () => {
    if (!currentPhoto) return;
    const baseUrl = eventHash
      ? `${window.location.origin}/gallery/${eventHash}`
      : window.location.href.split('?')[0];
    const shareUrl = `${baseUrl}?photo=${currentPhoto.id}`;

    if (navigator.share) {
      try { await navigator.share({ title: currentPhoto.original_filename, url: shareUrl }); return; }
      catch { /* cancelled */ }
    }

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

  useEffect(() => {
    setIsDownloading(false);
    setDownloadSuccess(false);
  }, [currentIndex]);

  const handleDownload = useCallback(async () => {
    if (!currentPhoto || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(currentPhoto.original_url)}&filename=${encodeURIComponent(currentPhoto.original_filename)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = currentPhoto.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch {
      window.open(currentPhoto.original_url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  }, [currentPhoto, isDownloading]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && canGoPrev) { e.preventDefault(); handlePrevious(); }
      else if (e.key === 'ArrowRight' && canGoNext) { e.preventDefault(); handleNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, canGoPrev, canGoNext, handlePrevious, handleNext, handleClose]);

  // Swipe navigation — only when NOT zoomed.
  // Touch zoom/pan is handled entirely by native listeners in useImageZoom,
  // so here we only need to track horizontal swipe for photo navigation.
  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && !zoom.isZoomed) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartX.current = null;
      touchStartY.current = null;
    }
  }, [zoom.isZoomed]);

  const handleSwipeTouchEnd = useCallback((e: React.TouchEvent) => {
    // Don't swipe-navigate if a zoom/pan gesture is active
    if (zoom.isZoomed || zoom.isPinching() || zoom.isPanning()) {
      touchStartX.current = null;
      return;
    }

    if (touchStartX.current !== null && e.changedTouches.length > 0) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = touchStartX.current - endX;
      const deltaY = touchStartY.current !== null ? touchStartY.current - endY : 0;
      touchStartX.current = null;
      touchStartY.current = null;
      // Ignore if more vertical than horizontal (scroll intent)
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
      if (deltaX > 0 && canGoNext) handleNext();
      else if (deltaX < 0 && canGoPrev) handlePrevious();
    }
  }, [zoom, canGoNext, canGoPrev, handleNext, handlePrevious]);

  if (!currentPhoto) return null;

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
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
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
          {canGoPrev && !zoom.isZoomed && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeftIcon className="text-white" />
            </button>
          )}

          {/* Next button */}
          {canGoNext && !zoom.isZoomed && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Next image"
            >
              <ChevronRightIcon className="text-white" />
            </button>
          )}

          {/* Main image display */}
          <div
            ref={zoom.containerRef}
            className={`relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center overflow-hidden ${zoom.isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            style={{ touchAction: 'none' }}
            onTouchStart={handleSwipeTouchStart}
            onTouchEnd={handleSwipeTouchEnd}
            onDoubleClick={zoom.handlers.onDoubleClick}
            onMouseDown={zoom.isZoomed ? zoom.handlers.onMouseDown : undefined}
            onClick={(e) => {
              if (e.target === e.currentTarget && !zoom.isZoomed) handleClose();
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImage}
              alt={currentPhoto.original_filename}
              draggable={false}
              className={`max-w-full max-h-full object-contain select-none ${loadingPhase === 'thumbnail' ? 'opacity-70' : 'opacity-100'}`}
              style={zoom.imageStyle}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Icon Components ────────────────────────────────────────

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
      <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
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
