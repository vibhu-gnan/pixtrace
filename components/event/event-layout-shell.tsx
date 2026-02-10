'use client';

import { useState } from 'react';
import type { EventData } from '@/actions/events';
import { EventSidebar } from './event-sidebar';
import { EventTopBar } from './event-top-bar';
import { Footer } from '@/components/dashboard/footer';

interface EventLayoutShellProps {
  event: EventData;
  children: React.ReactNode;
}

export function EventLayoutShell({ event, children }: EventLayoutShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-50">
      {/* Event Sidebar */}
      <EventSidebar
        eventId={event.id}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Event Top Bar */}
        <EventTopBar
          event={event}
          onMenuClick={() => setSidebarOpen(true)}
        />

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
