'use client';

import { useState, useCallback, useRef } from 'react';
import { useFaceSearch, type FaceSearchState } from '@/lib/face/use-face-search';
import { SelfieCamera } from './selfie-camera';
import { FaceSearchResultsView } from './face-search-results';

interface FaceSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  eventHash: string;
  albums: { id: string; name: string }[];
  onPhotoClick: (mediaId: string) => void;
}

export function FaceSearchSheet({
  isOpen,
  onClose,
  eventHash,
  albums,
  onPhotoClick,
}: FaceSearchSheetProps) {
  const { state, setState, results, error, search, reset } = useFaceSearch(eventHash);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieBlobRef = useRef<Blob | null>(null);

  const handleCapture = useCallback((blob: Blob) => {
    selfieBlobRef.current = blob;
    setSelfiePreview(URL.createObjectURL(blob));
    setState('confirming');
  }, [setState]);

  const handleSearch = useCallback(() => {
    if (selfieBlobRef.current) {
      search(selfieBlobRef.current);
    }
  }, [search]);

  const handleRetake = useCallback(() => {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfiePreview(null);
    selfieBlobRef.current = null;
    setState('capturing');
  }, [selfiePreview, setState]);

  const handleClose = useCallback(() => {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfiePreview(null);
    selfieBlobRef.current = null;
    reset();
    onClose();
  }, [selfiePreview, reset, onClose]);

  const handlePhotoClick = useCallback((mediaId: string) => {
    onPhotoClick(mediaId);
    handleClose();
  }, [onPhotoClick, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl animate-in slide-in-from-bottom duration-300"
        style={{
          background: 'linear-gradient(160deg, rgba(40,40,55,0.98), rgba(12,12,18,0.99))',
          backdropFilter: 'blur(48px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-lg font-semibold text-white">
            {state === 'results' || state === 'no_results' ? 'Your Photos' : 'Find Your Photos'}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-8">
          {/* CAPTURE state */}
          {(state === 'idle' || state === 'capturing') && (
            <SelfieCamera onCapture={handleCapture} onClose={handleClose} />
          )}

          {/* CONFIRM state */}
          {state === 'confirming' && selfiePreview && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-[320px] aspect-[3/4] rounded-2xl overflow-hidden">
                <img src={selfiePreview} alt="Your selfie" className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-3 w-full max-w-[320px]">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  Retake
                </button>
                <button
                  onClick={handleSearch}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
                  }}
                >
                  Find My Photos
                </button>
              </div>
            </div>
          )}

          {/* SEARCHING state */}
          {state === 'searching' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="relative">
                <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.8)" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
              <div className="text-sm text-gray-300">Finding your photos...</div>
              <div className="text-xs text-gray-500">This may take a few seconds</div>
            </div>
          )}

          {/* RESULTS state */}
          {state === 'results' && results && (
            <FaceSearchResultsView
              results={results}
              albums={albums}
              onPhotoClick={handlePhotoClick}
            />
          )}

          {/* NO RESULTS state */}
          {state === 'no_results' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <div className="text-sm text-gray-300">No matching photos found</div>
              <div className="text-xs text-gray-500 text-center max-w-[240px]">
                Your face wasn&apos;t found in this gallery. Try retaking your selfie with better lighting.
              </div>
              <button
                onClick={handleRetake}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-white"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* ERROR state */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="text-sm text-gray-300 text-center max-w-[280px]">
                {error}
              </div>
              <button
                onClick={handleRetake}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-white"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
