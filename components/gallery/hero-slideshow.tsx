'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface HeroSlideshowProps {
  slides: Array<{ url: string; mediaId: string }>;
  intervalMs?: number;
}

export function HeroSlideshow({ slides, intervalMs = 5000 }: HeroSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set([0]));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionDuration = 1200; // ms

  // Preload an image by index
  const preloadImage = useCallback((index: number) => {
    if (loadedIndices.has(index)) return;
    const img = new Image();
    img.src = slides[index].url;
    img.onload = () => {
      setLoadedIndices(prev => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    };
  }, [slides, loadedIndices]);

  // Advance to next slide
  const advance = useCallback(() => {
    const next = (currentIndex + 1) % slides.length;
    if (!loadedIndices.has(next)) return; // skip if not loaded yet
    setNextIndex(next);
    // After transition completes, swap
    setTimeout(() => {
      setCurrentIndex(next);
      setNextIndex(null);
    }, transitionDuration);
  }, [currentIndex, slides.length, loadedIndices]);

  // Preload next image on mount and when currentIndex changes
  useEffect(() => {
    const next = (currentIndex + 1) % slides.length;
    preloadImage(next);
    // Also preload the one after that
    const afterNext = (currentIndex + 2) % slides.length;
    preloadImage(afterNext);
  }, [currentIndex, slides.length, preloadImage]);

  // Auto-advance timer
  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    timerRef.current = setInterval(advance, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [advance, intervalMs]);

  // Pause on tab hidden
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const handleVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        if (!timerRef.current) {
          timerRef.current = setInterval(advance, intervalMs);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [advance, intervalMs]);

  // Don't render anything for single-slide (parent handles static SSR image)
  if (slides.length <= 1) return null;

  return (
    <>
      {slides.map((slide, i) => {
        const isCurrent = i === currentIndex;
        const isNext = i === nextIndex;
        const isVisible = isCurrent || isNext;

        if (!isVisible || !loadedIndices.has(i)) return null;

        return (
          <div
            key={slide.mediaId}
            className="absolute inset-0 overflow-hidden"
            style={{
              opacity: isNext ? 1 : isCurrent && nextIndex !== null ? 0 : 1,
              transition: `opacity ${transitionDuration}ms ease-in-out`,
              zIndex: isNext ? 2 : 1,
            }}
          >
            <img
              src={slide.url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover hero-slideshow-img"
              style={{
                animation: isVisible
                  ? `kenBurns${i % 4} ${intervalMs + transitionDuration}ms ease-in-out forwards`
                  : 'none',
              }}
            />
          </div>
        );
      })}
    </>
  );
}
