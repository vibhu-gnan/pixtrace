'use client';

// ─── Icons ───────────────────────────────────────────────────

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

// ─── Stats Bar ───────────────────────────────────────────────

interface StatsBarProps {
  albumCount: number;
  photoCount: number;
  videoCount: number;
}

export function StatsBar({ albumCount, photoCount, videoCount }: StatsBarProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 text-sm font-medium rounded-full border border-brand-200">
        <FolderIcon className="flex-shrink-0" />
        Albums
        <span className="bg-brand-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {albumCount}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-medium rounded-full border border-gray-200">
        <ImageIcon className="flex-shrink-0" />
        Photos
        <span className="bg-gray-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {photoCount}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-medium rounded-full border border-gray-200">
        <VideoIcon className="flex-shrink-0" />
        Videos
        <span className="bg-gray-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {videoCount}
        </span>
      </span>
    </div>
  );
}
