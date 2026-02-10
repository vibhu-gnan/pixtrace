'use client';

import Link from 'next/link';

// ─── SVG Icons ───────────────────────────────────────────────

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── TopBar Component ────────────────────────────────────────

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-4 bg-white border-b border-gray-200 px-4 sm:px-6 h-16 flex-shrink-0">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <MenuIcon className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Center: search */}
      <div className="hidden sm:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm text-gray-700 placeholder:text-gray-400 border-0 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-shadow"
            readOnly
          />
        </div>
      </div>

      {/* Right: bell + create */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <BellIcon className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Create Event button */}
        <Link
          href="/events/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
        >
          <PlusIcon className="text-white" />
          <span className="hidden sm:inline">Create Event</span>
        </Link>
      </div>
    </header>
  );
}
