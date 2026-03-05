'use client';

import { useState, Suspense } from 'react';
import type { EventData } from '@/actions/events';
import { EventSidebar } from './event-sidebar';
import { EventTopBar } from './event-top-bar';
import { Footer } from '@/components/dashboard/footer';
import { RouteProgress } from '@/components/UI/route-progress';

interface EventLayoutShellProps {
  event: EventData;
  coverPreviewUrl?: string | null;
  children: React.ReactNode;
}

export function EventLayoutShell({ event, coverPreviewUrl, children }: EventLayoutShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex bg-gray-50">
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>

      {/* Event Sidebar */}
      <EventSidebar
        eventId={event.id}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        coverPreviewUrl={coverPreviewUrl ?? null}
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
          <div className="animate-page-in">
            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
