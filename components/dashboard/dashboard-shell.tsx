'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OrganizerProfile } from '@/lib/auth/session';
import type { PlanLimits } from '@/lib/plans/limits';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { Footer } from './footer';

const COLLAPSED_KEY = 'pixtrace-sidebar-collapsed';

/** Safe localStorage read — returns null on SSR / private browsing / quota errors */
function readLocalStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Safe localStorage write — silently ignores errors */
function writeLocalStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // quota exceeded or private browsing — ignore
  }
}

interface DashboardShellProps {
  organizer: OrganizerProfile;
  planLimits: PlanLimits;
  children: React.ReactNode;
}

export function DashboardShell({ organizer, planLimits, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Start expanded (false) — hydrate from localStorage after mount
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readLocalStorage(COLLAPSED_KEY);
    if (stored === 'true') setCollapsed(true);
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeLocalStorage(COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        organizer={organizer}
        planLimits={planLimits}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={hydrated ? collapsed : false}
        onToggleCollapse={toggleCollapsed}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
