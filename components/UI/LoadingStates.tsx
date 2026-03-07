'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

// ─── Spinner ─────────────────────────────────────────────────
// Two visual styles:
//   "svg"  – classic circle+arc (default, good for inline/button contexts)
//   "ring" – CSS border ring (lighter feel, used in gallery/overlay contexts)

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: 'svg' | 'ring';
  className?: string;
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

const RING_BORDER: Record<SpinnerSize, string> = {
  xs: 'border-[2px]',
  sm: 'border-2',
  md: 'border-[2.5px]',
  lg: 'border-[3px]',
  xl: 'border-[3px]',
};

export function LoadingSpinner({ size = 'md', variant = 'svg', className = '' }: LoadingSpinnerProps) {
  if (variant === 'ring') {
    return (
      <div
        className={`animate-spin rounded-full border-gray-200 border-t-gray-600 ${SIZE_CLASSES[size]} ${RING_BORDER[size]} ${className}`}
      />
    );
  }

  return (
    <div className={`animate-spin ${SIZE_CLASSES[size]} ${className}`}>
      <svg className="w-full h-full text-current" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className = '', children }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-slate-700/50 rounded ${className}`}>
      {children}
    </div>
  );
}

// ─── Lazy Image ──────────────────────────────────────────────

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  skeletonClassName?: string;
}

export function LazyImage({
  src,
  alt,
  fallback = '/images/placeholder.jpg',
  skeletonClassName = '',
  className = '',
  ...props
}: LazyImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    setImageSrc(src);
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    if (!hasError && imageSrc !== fallback) {
      setHasError(true);
      setImageSrc(fallback);
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <Skeleton className={`absolute inset-0 ${skeletonClassName}`} />
      )}
      <Image
        src={typeof imageSrc === 'string' ? imageSrc : ''}
        alt={alt || ''}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-1'} ${className}`}
        loading="lazy"
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  );
}
