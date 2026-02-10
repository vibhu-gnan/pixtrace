'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Progress from '@radix-ui/react-progress';

// ─── SVG Icons ───────────────────────────────────────────────

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ─── Sidebar Component ──────────────────────────────────────

interface EventSidebarProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

export function EventSidebar({ eventId, open, onClose }: EventSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Photos', href: `/events/${eventId}/photos`, icon: PhotoIcon },
    { label: 'Design', href: `/events/${eventId}/design`, icon: PenIcon },
    { label: 'Permissions', href: `/events/${eventId}/permissions`, icon: KeyIcon },
    { label: 'Settings', href: `/events/${eventId}/settings`, icon: CogIcon },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-brand-50/40 border-r border-gray-100">
      {/* Close button (mobile) + Back to Dashboard + Cover Page */}
      <div className="px-4 pt-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand-600 transition-colors"
          >
            <ArrowLeftIcon />
            Dashboard
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close sidebar"
          >
            <MenuIcon className="text-gray-600" />
          </button>
        </div>

        {/* Cover Page section */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 text-center mb-2">Cover Page</p>
          <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 h-36 flex flex-col items-center justify-center">
            <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjNmNGY2Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmM2Y0ZjYiLz48L3N2Zz4=')] rounded-lg flex items-center justify-center">
              <button className="px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm">
                Upload from computer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={isActive ? 'text-white' : 'text-gray-400'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Storage Card */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Storage</span>
            <span className="text-xs font-bold text-brand-500">75%</span>
          </div>
          <Progress.Root
            className="relative overflow-hidden bg-gray-100 rounded-full w-full h-2"
            value={75}
          >
            <Progress.Indicator
              className="bg-brand-500 h-full rounded-full transition-transform duration-500"
              style={{ width: '75%' }}
            />
          </Progress.Root>
          <p className="text-[11px] text-gray-400 mt-2">15GB of 20GB used</p>
          <button className="w-full mt-3 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors">
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
