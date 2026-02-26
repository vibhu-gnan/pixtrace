'use client';

interface FaceSearchToggleProps {
  active: boolean;
  onToggle: () => void;
}

export function FaceSearchToggle({ active, onToggle }: FaceSearchToggleProps) {
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

      {/* Accuracy disclaimer — only when toggled to Mine */}
      {active && (
        <div className="pointer-events-none mt-2 px-4 py-1 rounded-full text-[10px] text-white/50"
          style={{ background: 'rgba(30,30,45,0.8)', backdropFilter: 'blur(8px)' }}
        >
          AI powered - accuracy may vary
        </div>
      )}
    </div>
  );
}
