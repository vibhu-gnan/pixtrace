'use client';

interface FaceSearchToggleProps {
  active: boolean;
  hasSearched: boolean;
  hasProfile: boolean | null;
  recalling: boolean;
  onToggle: () => void;
  onRescan?: () => void;
}

export function FaceSearchToggle({
  active,
  hasSearched,
  hasProfile,
  recalling,
  onToggle,
  onRescan,
}: FaceSearchToggleProps) {
  // Before first search: show "Find Your Photos" CTA
  if (!hasSearched) {
    return (
      <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none animate-in slide-in-from-bottom duration-500">
        <button
          onClick={onToggle}
          disabled={recalling}
          className="pointer-events-auto flex items-center gap-2.5 px-6 py-3 rounded-full text-white text-sm font-medium shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
          }}
        >
          {recalling ? (
            <>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Loading your photos...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Find Your Photos
            </>
          )}
        </button>
      </div>
    );
  }

  // After first search: show ALL/Mine toggle
  return (
    <div className="fixed bottom-6 left-0 right-0 z-30 flex flex-col items-center pointer-events-none animate-in slide-in-from-bottom duration-500">
      <button
        onClick={onToggle}
        className="pointer-events-auto flex items-center gap-0 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'rgba(30,30,45,0.92)',
          backdropFilter: 'blur(16px) saturate(150%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* ALL label */}
        <span
          className={`px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors ${
            !active ? 'text-white' : 'text-white/40'
          }`}
        >
          ALL
        </span>

        {/* Toggle track */}
        <div className="relative w-11 h-6 rounded-full mx-1 transition-colors duration-300"
          style={{ background: active ? '#6366f1' : 'rgba(255,255,255,0.15)' }}
        >
          {/* Toggle thumb */}
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300"
            style={{ transform: active ? 'translateX(22px)' : 'translateX(2px)' }}
          />
        </div>

        {/* Mine label */}
        <span
          className={`px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors ${
            active ? 'text-white' : 'text-white/40'
          }`}
        >
          Mine
        </span>
      </button>

      {/* Accuracy disclaimer + re-scan — only when toggled to Mine */}
      {active && (
        <div className="flex items-center gap-2 mt-2">
          <div className="pointer-events-none px-4 py-1 rounded-full text-[10px] text-white/50"
            style={{ background: 'rgba(30,30,45,0.8)', backdropFilter: 'blur(8px)' }}
          >
            AI powered - accuracy may vary
          </div>
          {onRescan && (
            <button
              onClick={(e) => { e.stopPropagation(); onRescan(); }}
              className="pointer-events-auto px-3 py-1 rounded-full text-[10px] text-white/60 hover:text-white/90 transition-colors"
              style={{ background: 'rgba(30,30,45,0.8)', backdropFilter: 'blur(8px)' }}
            >
              Re-scan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
