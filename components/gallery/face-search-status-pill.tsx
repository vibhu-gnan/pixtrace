'use client';

import { useEffect, useRef } from 'react';
import type { FaceSearchState } from '@/lib/face/use-face-search';

interface FaceSearchStatusPillProps {
  state: FaceSearchState;
  matchCount: number;
  errorMessage: string | null;
  onViewResults: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_RESULTS_MS = 8000;
const AUTO_DISMISS_NO_RESULTS_MS = 5000;

export function FaceSearchStatusPill({
  state,
  matchCount,
  errorMessage,
  onViewResults,
  onRetry,
  onDismiss,
}: FaceSearchStatusPillProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss for results and no_results states
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (state === 'results') {
      timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_RESULTS_MS);
    } else if (state === 'no_results') {
      timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_NO_RESULTS_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, onDismiss]);

  if (state === 'idle') return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none animate-in slide-in-from-bottom duration-300">
      {state === 'searching' && <SearchingPill />}
      {state === 'results' && (
        <ResultsPill matchCount={matchCount} onTap={onViewResults} />
      )}
      {state === 'no_results' && <NoResultsPill onDismiss={onDismiss} />}
      {state === 'error' && (
        <ErrorPill message={errorMessage} onRetry={onRetry} onDismiss={onDismiss} />
      )}
    </div>
  );
}

// ─── Sub-pills ───────────────────────────────────────────────

const PILL_STYLE = {
  background: 'rgba(30,30,45,0.92)',
  backdropFilter: 'blur(16px) saturate(150%)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.1)',
} as const;

function SearchingPill() {
  return (
    <div
      className="pointer-events-auto flex items-center gap-2.5 px-5 py-3 rounded-full"
      style={PILL_STYLE}
    >
      <svg
        className="animate-spin flex-shrink-0"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(139,92,246,0.9)"
        strokeWidth="2.5"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="text-sm text-white/80 font-medium">
        Searching for your photos...
      </span>
    </div>
  );
}

function ResultsPill({ matchCount, onTap }: { matchCount: number; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="pointer-events-auto flex items-center gap-2.5 px-5 py-3 rounded-full transition-all hover:scale-105 active:scale-95 animate-in zoom-in-95 duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.95), rgba(139,92,246,0.95))',
        backdropFilter: 'blur(16px) saturate(150%)',
        boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span className="text-sm text-white font-semibold">
        Found {matchCount} photo{matchCount !== 1 ? 's' : ''} of you!
      </span>
      <span className="text-xs text-white/60 font-medium">Tap to view</span>
    </button>
  );
}

function NoResultsPill({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      onClick={onDismiss}
      className="pointer-events-auto flex items-center gap-2.5 px-5 py-3 rounded-full transition-all hover:scale-105 active:scale-95"
      style={PILL_STYLE}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
      <span className="text-sm text-white/60 font-medium">
        No matching photos found
      </span>
    </button>
  );
}

function ErrorPill({
  message,
  onRetry,
  onDismiss,
}: {
  message: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full"
      style={{
        ...PILL_STYLE,
        border: '1px solid rgba(239,68,68,0.3)',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(239,68,68,0.8)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="text-xs text-white/60 max-w-[180px] truncate">
        {message || 'Search failed'}
      </span>
      <button
        onClick={onRetry}
        className="px-2.5 py-1 text-xs font-semibold text-white rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.12)' }}
      >
        Retry
      </button>
      <button
        onClick={onDismiss}
        className="p-1 text-white/30 hover:text-white/60 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
