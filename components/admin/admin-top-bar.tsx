'use client';

import Link from 'next/link';

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

interface AdminTopBarProps {
  onMenuClick: () => void;
}

export function AdminTopBar({ onMenuClick }: AdminTopBarProps) {
  return (
    <header className="flex items-center justify-between gap-4 bg-white border-b border-gray-200 px-4 sm:px-6 h-16 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <MenuIcon className="text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
            Admin
          </span>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ArrowLeftIcon className="text-gray-400" />
        <span className="hidden sm:inline">Back to Dashboard</span>
      </Link>
    </header>
  );
}
