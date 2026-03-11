'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Progress from '@radix-ui/react-progress';
import type { OrganizerProfile } from '@/lib/auth/session';
import type { PlanLimits } from '@/lib/plans/limits';
import { SignOutButton } from './sign-out-button';

// ─── SVG Icons ───────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
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

// ─── Nav Config ──────────────────────────────────────────────

const navItems = [
  { label: 'My Events', href: '/dashboard', icon: HomeIcon, enabled: true },
  { label: 'Billing', href: '/billing', icon: CreditCardIcon, enabled: true },
  { label: 'Analytics', href: '#', icon: ChartIcon, enabled: false },
  { label: 'Settings', href: '#', icon: CogIcon, enabled: false },
];

// ─── Tooltip wrapper for collapsed state ─────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 z-50">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </div>
    </div>
  );
}

// ─── Sidebar Component ──────────────────────────────────────

interface SidebarProps {
  organizer: OrganizerProfile;
  planLimits: PlanLimits;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ organizer, planLimits, open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  const isUnlimitedStorage = planLimits.storageLimitBytes === 0;
  const storagePercent = isUnlimitedStorage
    ? 0
    : Math.min(100, Math.round((planLimits.storageUsedBytes / planLimits.storageLimitBytes) * 100));
  const usedDisplay = formatBytes(planLimits.storageUsedBytes);
  const limitDisplay = isUnlimitedStorage ? 'Unlimited' : formatBytes(planLimits.storageLimitBytes);

  // ─── Shared nav item renderer ─────────────────────────────
  function renderNavItem(item: typeof navItems[number], isCollapsed: boolean, closeMobile?: () => void) {
    const isActive = item.enabled && (pathname === item.href || pathname.startsWith(item.href + '/'));
    const Icon = item.icon;

    if (!item.enabled) {
      const content = (
        <div
          key={item.label}
          className={`flex items-center rounded-lg text-sm text-gray-400 cursor-not-allowed select-none ${
            isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <Icon className="text-gray-300 flex-shrink-0" />
          {!isCollapsed && <span>{item.label}</span>}
        </div>
      );
      return isCollapsed ? <Tooltip key={item.label} label={item.label}>{content}</Tooltip> : content;
    }

    const link = (
      <Link
        key={item.label}
        href={item.href}
        onClick={closeMobile}
        className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
          isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
        } ${isActive
          ? 'bg-brand-500 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
        {!isCollapsed && <span>{item.label}</span>}
      </Link>
    );
    return isCollapsed ? <Tooltip key={item.label} label={item.label}>{link}</Tooltip> : link;
  }

  // ─── Storage card (full) ──────────────────────────────────
  function renderStorageCard(closeMobile?: () => void) {
    return (
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Storage</span>
            {!isUnlimitedStorage && (
              <span className={`text-xs font-bold ${storagePercent >= 90 ? 'text-red-500' : 'text-brand-500'}`}>
                {storagePercent}%
              </span>
            )}
          </div>
          {!isUnlimitedStorage && (
            <Progress.Root
              className="relative overflow-hidden bg-gray-100 rounded-full w-full h-2"
              value={storagePercent}
            >
              <Progress.Indicator
                className={`h-full rounded-full transition-transform duration-500 ${storagePercent >= 90 ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${storagePercent}%` }}
              />
            </Progress.Root>
          )}
          <p className="text-[11px] text-gray-400 mt-2">
            {usedDisplay} of {limitDisplay} used
          </p>
          {planLimits.isOverLimit && planLimits.storageGraceDeadline ? (
            <div className="mt-2 text-[11px] font-medium px-2 py-1 rounded bg-red-50 text-red-600">
              Over limit! {planLimits.graceDaysRemaining != null && planLimits.graceDaysRemaining > 0
                ? `${planLimits.graceDaysRemaining} day${planLimits.graceDaysRemaining !== 1 ? 's' : ''} left`
                : 'Grace period expired'}
            </div>
          ) : !isUnlimitedStorage && storagePercent >= 80 && (
            <div className={`mt-2 text-[11px] font-medium px-2 py-1 rounded ${
              storagePercent >= 95
                ? 'bg-red-50 text-red-600'
                : 'bg-amber-50 text-amber-600'
            }`}>
              {storagePercent >= 95
                ? 'Storage almost full! Upgrade now.'
                : 'Running low on storage.'}
            </div>
          )}
          {planLimits.planId !== 'enterprise' && (
            <Link
              href="/pricing"
              onClick={closeMobile}
              className={`block w-full mt-3 text-xs font-medium text-center rounded-lg py-2 transition-colors ${
                !isUnlimitedStorage && storagePercent >= 90
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {planLimits.planId === 'free' ? 'Upgrade Plan' : 'Change Plan'}
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ─── Storage bar (collapsed — minimal) ────────────────────
  function renderStorageBar() {
    return (
      <Tooltip label={`${usedDisplay} of ${limitDisplay} used`}>
        <div className="px-3 pb-3">
          <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${storagePercent >= 90 ? 'bg-red-500' : 'bg-brand-500'}`}
              style={{ width: `${Math.max(storagePercent, 3)}%` }}
            />
          </div>
        </div>
      </Tooltip>
    );
  }

  // ─── User profile (full) ──────────────────────────────────
  function renderUserProfile(isCollapsed: boolean) {
    const avatar = organizer.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={organizer.avatar_url}
        alt=""
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    ) : (
      <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-white">
          {(organizer.name || organizer.email)?.[0]?.toUpperCase() || '?'}
        </span>
      </div>
    );

    if (isCollapsed) {
      return (
        <div className="border-t border-gray-100 py-4 flex justify-center px-2">
          <Tooltip label={organizer.name || organizer.email || 'Account'}>
            {avatar}
          </Tooltip>
        </div>
      );
    }

    return (
      <div className="border-t border-gray-100 px-4 py-4 flex items-center gap-3">
        {avatar}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {organizer.name || organizer.email?.split('@')[0]}
          </p>
          <p className="text-[11px] text-gray-400">{planLimits.planName} Plan</p>
        </div>
        <SignOutButton />
      </div>
    );
  }

  // ─── Desktop sidebar (collapsible) ────────────────────────
  const desktopContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-brand-50/40 border-r border-gray-200 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Header: Logo + collapse toggle */}
      <div className={`flex items-center h-16 flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-2 min-w-0 cursor-pointer"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <span className="text-lg font-bold text-brand-600 tracking-tight">P</span>
          </button>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <span className="text-xl font-bold text-brand-600 tracking-tight">PIXTRACE</span>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeftIcon />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => renderNavItem(item, collapsed))}

        {/* Expand button (only when collapsed) */}
        {collapsed && (
          <Tooltip label="Expand sidebar">
            <button
              onClick={onToggleCollapse}
              className="flex items-center justify-center w-full py-2.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors mt-2"
              aria-label="Expand sidebar"
            >
              <ChevronRightIcon />
            </button>
          </Tooltip>
        )}
      </nav>

      {/* Storage */}
      {collapsed ? renderStorageBar() : renderStorageCard()}

      {/* User */}
      {renderUserProfile(collapsed)}
    </div>
  );

  // ─── Mobile sidebar (always expanded, never collapsible) ──
  const mobileContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-brand-50/40 border-r border-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 h-16 flex-shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close sidebar"
        >
          <MenuIcon className="text-gray-600" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
          <span className="text-xl font-bold text-brand-600 tracking-tight">PIXTRACE</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => renderNavItem(item, false, onClose))}
      </nav>

      {/* Storage */}
      {renderStorageCard(onClose)}

      {/* User */}
      {renderUserProfile(false)}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible, animated width */}
      <aside
        className={`hidden lg:flex flex-shrink-0 h-full transition-[width] duration-300 ease-in-out ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {desktopContent}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden">
            {mobileContent}
          </aside>
        </>
      )}
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)}MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)}KB`;
}
