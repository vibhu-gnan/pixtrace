'use client';

import { useState } from 'react';
import type { OrganizerProfile } from '@/lib/auth/session';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { Footer } from './footer';

interface DashboardShellProps {
  organizer: OrganizerProfile;
  children: React.ReactNode;
}

export function DashboardShell({ organizer, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        organizer={organizer}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
