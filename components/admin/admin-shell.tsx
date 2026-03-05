'use client';

import { useState } from 'react';
import type { OrganizerProfile } from '@/lib/auth/session';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopBar } from './admin-top-bar';

interface AdminShellProps {
  organizer: OrganizerProfile;
  children: React.ReactNode;
}

export function AdminShell({ organizer, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar
        organizer={organizer}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminTopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
