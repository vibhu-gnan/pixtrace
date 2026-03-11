'use client';

// ─── Icons ──────────────────────────────────────────────────

function PhotoGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────

interface AllPhotosCardProps {
  totalCount: number;
  onClick: () => void;
  layout: 'grid' | 'list';
}

function formatCount(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(n);
}

export function AllPhotosCard({ totalCount, onClick, layout }: AllPhotosCardProps) {
  if (layout === 'list') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-4 p-3 bg-brand-50/50 rounded-xl border border-brand-100 hover:bg-brand-50 transition-all w-full text-left"
      >
        {/* Spacer for drag handle alignment */}
        <div className="w-5 flex-shrink-0" />

        {/* Icon thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
          <PhotoGridIcon className="text-brand-500" />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-brand-700">All Photos</h3>
          <p className="text-xs text-brand-400">View all media across albums</p>
        </div>

        {/* Count */}
        <span className="text-sm text-brand-600 font-medium flex-shrink-0">
          {formatCount(totalCount)} items
        </span>

        <ChevronRightIcon className="text-brand-300 flex-shrink-0" />
      </button>
    );
  }

  // Grid layout
  return (
    <button
      onClick={onClick}
      className="block w-full text-left rounded-2xl overflow-hidden bg-brand-50 border-2 border-brand-200 border-dashed hover:border-brand-400 hover:bg-brand-100/50 transition-all duration-200 group"
    >
      <div className="relative h-48 w-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200/50">
        <div className="text-center">
          <PhotoGridIcon className="mx-auto text-brand-400 mb-2 w-10 h-10" />
          <h3 className="text-lg font-bold text-brand-700">All Photos</h3>
          <p className="text-xs text-brand-400 mt-1">View all media</p>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[10px] text-brand-400 uppercase tracking-wider font-medium">Total</p>
        <p className="text-base font-bold text-brand-700">{formatCount(totalCount)}</p>
      </div>
    </button>
  );
}
