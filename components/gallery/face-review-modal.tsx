'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FaceSearchResult } from '@/lib/face/use-face-search';

interface FaceReviewModalProps {
  /** Undecided review-band candidates (score < FINAL_THRESHOLD, not yet confirmed/rejected). */
  candidates: FaceSearchResult[];
  onConfirm: (mediaId: string) => void;
  onReject: (mediaId: string) => void;
  onClose: () => void;
  showScore?: boolean;
}

/**
 * One-at-a-time review of lower-confidence face matches.
 * The user swipes/taps "This is me" (keep) or "Not me" (drop) through each candidate.
 *
 * `candidates` is the parent's live list of *undecided* photos. Each decision removes that
 * id from the parent's set — and the parent may auto-resolve others as its face prototype
 * sharpens — so we always render the head (`candidates[0]`) and close once it's empty.
 */
export function FaceReviewModal({
  candidates,
  onConfirm,
  onReject,
  onClose,
  showScore = false,
}: FaceReviewModalProps) {
  // Consume the live queue head. The parent removes each decided photo from `candidates`
  // and also auto-resolves others as the prototype sharpens, so `candidates[0]` is always
  // the next photo genuinely needing a human — the deck shrinks (sometimes by more than one)
  // as we go, and stale/auto-matched photos never appear.
  const current = candidates[0];
  const remaining = candidates.length;

  const handleConfirm = useCallback(() => {
    if (current) onConfirm(current.media_id);
  }, [current, onConfirm]);

  const handleReject = useCallback(() => {
    if (current) onReject(current.media_id);
  }, [current, onReject]);

  // Queue emptied (everything decided or auto-resolved) → done reviewing.
  useEffect(() => {
    if (candidates.length === 0) onClose();
  }, [candidates.length, onClose]);

  // Keyboard: →/Enter = keep, ← = drop, Esc = close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handleReject(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleConfirm, handleReject, onClose]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet — bottom sheet on mobile, centered dialog on desktop */}
      <div
        className="relative w-full max-w-lg sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl animate-in slide-in-from-bottom sm:zoom-in-95 sm:fade-in duration-300"
        style={{
          background: 'linear-gradient(160deg, rgba(40,40,55,0.98), rgba(12,12,18,0.99))',
          backdropFilter: 'blur(48px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Handle — drag affordance on mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Is this you?</h2>
            <p className="text-xs text-white/50 leading-tight">
              {remaining} photo{remaining === 1 ? '' : 's'} left to review
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            aria-label="Close review"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-8">
          <div className="flex flex-col items-center gap-4">
            <ReviewImage key={current.media_id} candidate={current} showScore={showScore} />

            <div className="flex gap-3 w-full max-w-[360px] sm:max-w-[440px]">
              <button
                onClick={handleReject}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Not me
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 4px 15px rgba(34,197,94,0.3)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                This is me
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Review image with the same R2-URL fallback chain as MasonryThumbnail ───
function ReviewImage({ candidate, showScore }: { candidate: FaceSearchResult; showScore: boolean }) {
  const [imgSrc, setImgSrc] = useState(candidate.preview_url || candidate.original_url);
  const retryCount = useRef(0);
  const MAX_RETRIES = 2;

  const handleError = () => {
    retryCount.current++;
    if (retryCount.current > MAX_RETRIES) return;
    if (imgSrc !== candidate.original_url && candidate.original_url) {
      setImgSrc(candidate.original_url);
    }
  };

  return (
    // Hug the image's natural shape (portrait or landscape) — cap height so tall photos
    // fit and let wide group shots use the full dialog width, no fixed-aspect black bars.
    <div className="relative rounded-2xl overflow-hidden bg-black/30 max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt="Photo to review"
        onError={handleError}
        className="block w-auto max-w-full max-h-[52vh] sm:max-h-[60vh] object-contain"
      />
      {showScore && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[11px] font-mono font-bold leading-none bg-black/60 text-white">
          {candidate.score.toFixed(3)}
        </div>
      )}
    </div>
  );
}
