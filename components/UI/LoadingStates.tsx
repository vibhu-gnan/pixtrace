'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`animate-spin ${sizeClasses[size]} ${className}`}>
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

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className = '', children }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}>
      {children}
    </div>
  );
}

// ─── Reusable Loading Button ─────────────────────────────────

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export function LoadingButton({ loading, children, disabled, className = '', ...props }: LoadingButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`relative transition-all ${loading ? 'cursor-wait' : ''} ${className}`}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" />
        </span>
      )}
      <span className={loading ? 'invisible' : ''}>{children}</span>
    </button>
  );
}

// ─── Table Skeleton ──────────────────────────────────────────

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 flex gap-6">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 rounded-md flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-6 py-4 flex gap-6 items-center">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-4 rounded-md ${c === 0 ? 'flex-[2]' : 'flex-1'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Card Skeleton ─────────────────────────────────────

export function StatsCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
          <div className="h-7 w-16 bg-gray-200 rounded" />
        </div>
        <div className="w-10 h-10 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

// ─── Event Card Skeleton ─────────────────────────────────────

export function EventCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="flex gap-8">
          <div>
            <div className="h-2 bg-gray-200 rounded w-10 mb-1" />
            <div className="h-5 bg-gray-200 rounded w-8" />
          </div>
          <div>
            <div className="h-2 bg-gray-200 rounded w-10 mb-1" />
            <div className="h-5 bg-gray-200 rounded w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Loading Bar ────────────────────────────────────────

export function PageLoadingBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5">
      <div className="h-full bg-brand-500 animate-loading-bar rounded-r" />
    </div>
  );
}

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
