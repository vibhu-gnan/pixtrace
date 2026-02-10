'use client';

// ─── SVG Illustration ────────────────────────────────────────

function CameraIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background photo cards */}
      <rect x="25" y="30" width="50" height="40" rx="6" fill="#E5E7EB" transform="rotate(-8 25 30)" />
      <rect x="40" y="25" width="50" height="40" rx="6" fill="#D1D5DB" transform="rotate(5 40 25)" />

      {/* Main camera body */}
      <rect x="28" y="40" width="64" height="48" rx="10" fill="#6366F1" />
      <rect x="28" y="40" width="64" height="48" rx="10" fill="url(#cameraGrad)" />

      {/* Camera lens */}
      <circle cx="60" cy="62" r="16" fill="#4F46E5" />
      <circle cx="60" cy="62" r="11" fill="#312E81" />
      <circle cx="60" cy="62" r="6" fill="#6366F1" />
      <circle cx="56" cy="58" r="2.5" fill="white" opacity="0.6" />

      {/* Flash */}
      <rect x="44" y="43" width="8" height="5" rx="2" fill="#A5B4FC" />

      {/* Viewfinder */}
      <rect x="70" y="43" width="14" height="8" rx="3" fill="#4F46E5" />

      {/* Small photos floating */}
      <rect x="78" y="65" width="22" height="18" rx="3" fill="#A5B4FC" transform="rotate(12 78 65)" />
      <rect x="82" y="68" width="14" height="10" rx="2" fill="#818CF8" transform="rotate(12 82 68)" />

      {/* Play button on video */}
      <circle cx="40" cy="78" r="10" fill="#A5B4FC" />
      <polygon points="38,73 46,78 38,83" fill="white" />

      {/* Decorative sparkles */}
      <circle cx="95" cy="35" r="2" fill="#FCD34D" />
      <circle cx="20" cy="55" r="1.5" fill="#34D399" />
      <circle cx="100" cy="75" r="1.5" fill="#F472B6" />

      <defs>
        <linearGradient id="cameraGrad" x1="28" y1="40" x2="92" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.71 3.5L1.15 15l3.43 5.98L11.14 9.5 7.71 3.5zm1.14 0l6.86 12H22.3L15.43 3.5H8.85zM15 14l-3.43 6h13.72l3.43-6H15z" opacity="0.7" />
    </svg>
  );
}

// ─── Empty State ─────────────────────────────────────────────

interface AlbumsEmptyStateProps {
  onAddAlbum: () => void;
}

export function AlbumsEmptyState({ onAddAlbum }: AlbumsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* Illustration */}
      <div className="mb-8">
        <CameraIllustration />
      </div>

      {/* Heading */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        Looks like you don&apos;t have any album yet!
      </h3>

      {/* Subtitle */}
      <p className="text-sm text-gray-400 text-center max-w-md mb-8">
        Upload your photos by adding an album or syncing your Google Drive
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={onAddAlbum}
          className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
        >
          Add Album
        </button>
        <span className="text-sm text-gray-400 font-medium">OR</span>
        <button
          disabled
          className="inline-flex items-center gap-2 px-6 py-2.5 border border-gray-300 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed bg-white"
        >
          Google Drive
          <GoogleDriveIcon className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}
