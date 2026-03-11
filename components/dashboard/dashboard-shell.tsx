'use client';

import { useState, useEffect } from 'react';
import type { OrganizerProfile } from '@/lib/auth/session';
import type { PlanLimits } from '@/lib/plans/limits';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { Footer } from './footer';

const COLLAPSED_KEY = 'sidebar-collapsed';

interface DashboardShellProps {
  organizer: OrganizerProfile;
  planLimits: PlanLimits;
  children: React.ReactNode;
}

export function DashboardShell({ organizer, planLimits, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Default to expanded; hydrate from localStorage after mount
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored === 'true') setCollapsed(true);
    } catch { /* SSR / private browsing */ }
    setHydrated(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

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
