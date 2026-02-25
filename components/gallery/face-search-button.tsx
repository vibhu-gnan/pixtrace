'use client';

interface FaceSearchButtonProps {
  onClick: () => void;
}

export function FaceSearchButton({ onClick }: FaceSearchButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 rounded-full text-white text-sm font-medium shadow-lg transition-all hover:scale-105 active:scale-95 animate-in slide-in-from-bottom-4 duration-500"
      style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
      Find Your Photos
    </button>
  );
}
