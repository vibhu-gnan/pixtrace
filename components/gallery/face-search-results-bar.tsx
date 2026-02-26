'use client';

interface FaceSearchResultsBarProps {
  count: number;
  onDismiss: () => void;
}

export function FaceSearchResultsBar({ count, onDismiss }: FaceSearchResultsBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 animate-in slide-in-from-bottom duration-300"
      style={{
        background: 'rgba(17,17,27,0.92)',
        backdropFilter: 'blur(16px) saturate(150%)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white">
              Showing {count} {count === 1 ? 'photo' : 'photos'} of you
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Show all photos
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
