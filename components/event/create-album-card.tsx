'use client';

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

interface CreateAlbumCardProps {
  onCreateAlbum: () => void;
}

export function CreateAlbumCard({ onCreateAlbum }: CreateAlbumCardProps) {
  return (
    <button
      onClick={onCreateAlbum}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white/50 p-8 min-h-[296px] hover:border-brand-400 hover:bg-brand-50/30 transition-all duration-200 group w-full"
    >
      <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mb-4 group-hover:bg-brand-200 transition-colors">
        <PlusCircleIcon className="text-brand-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Create New</h3>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">album</h3>
      <p className="text-sm text-gray-400 text-center max-w-[200px]">
        Start a new gallery for your guests or upload photos
      </p>
    </button>
  );
}
