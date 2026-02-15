'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface HeroSlideshowProps {
  slides: Array<{ url: string; mediaId: string }>;
  mobileSlides?: Array<{ url: string; mediaId: string }>; // portrait/mobile override
  intervalMs?: number;
}

export function HeroSlideshow({ slides, mobileSlides = [], intervalMs = 5000 }: HeroSlideshowProps) {
  // Pick slide set based on viewport orientation/width — mobile portrait gets mobileSlides if configured
  const isMobilePortrait = typeof window !== 'undefined'
    ? window.innerWidth < 768 && window.innerHeight > window.innerWidth
    : false;
  const activeSlides = (isMobilePortrait && mobileSlides.length >= 2) ? mobileSlides : slides;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set([0]));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedRef = useRef<Set<number>>(new Set([0]));
  const preloadingRef = useRef<Set<number>>(new Set());
  const transitionDuration = 1200; // ms

  // Keep ref in sync with state
  useEffect(() => {
    loadedRef.current = loadedIndices;
  }, [loadedIndices]);

  // Preload an image by index — uses ref to avoid stale closure issues
  const preloadImage = useCallback((index: number) => {
    if (loadedRef.current.has(index) || preloadingRef.current.has(index)) return;
    preloadingRef.current.add(index);
    const img = new Image();
    img.src = activeSlides[index].url;
    img.onload = () => {
      preloadingRef.current.delete(index);
      setLoadedIndices(prev => {
        if (prev.has(index)) return prev;
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    };
    img.onerror = () => {
      preloadingRef.current.delete(index);
    };
  }, [activeSlides]);

  // Advance to next slide
  const advance = useCallback(() => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % activeSlides.length;
      if (!loadedRef.current.has(next)) return prev; // skip if not loaded
      setNextIndex(next);
      setTimeout(() => {
        setCurrentIndex(next);
        setNextIndex(null);
      }, transitionDuration);
      return prev; // don't change yet — setTimeout will do it
    });
  }, [activeSlides.length]);

  // Preload next image on mount and when currentIndex changes
  useEffect(() => {
    const next = (currentIndex + 1) % activeSlides.length;
    preloadImage(next);
    const afterNext = (currentIndex + 2) % activeSlides.length;
    preloadImage(afterNext);
  }, [currentIndex, activeSlides.length, preloadImage]);

  // Auto-advance timer
  useEffect(() => {
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
  if (activeSlides.length <= 1) return null;

  return (
    <>
      {activeSlides.map((slide, i) => {
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
