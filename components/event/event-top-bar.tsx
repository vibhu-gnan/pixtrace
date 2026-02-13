'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EventData } from '@/actions/events';
import { PublishModal } from './publish-modal';

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

interface EventTopBarProps {
  event: EventData;
  onMenuClick: () => void;
}

export function EventTopBar({ event, onMenuClick }: EventTopBarProps) {
  const [showPublishModal, setShowPublishModal] = useState(false);

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : null;

  const isPublished = event.is_public;

  return (
    <>
      <header className="flex items-center justify-between gap-4 bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex-shrink-0">
        {/* Left: hamburger (mobile) + back + event name */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <MenuIcon className="text-gray-600" />
          </button>

          <Link
            href="/dashboard"
            className="p-1 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <BackIcon className="text-gray-500" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{event.name}</h1>
            {formattedDate && (
              <p className="text-xs text-gray-400">{formattedDate}</p>
            )}
          </div>
        </div>

        {/* Right: Preview + Publish */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:block">
            Preview
          </button>

          {isPublished ? (
            <button
              onClick={() => setShowPublishModal(true)}
              className="px-4 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Published
            </button>
          ) : (
            <button
              onClick={() => setShowPublishModal(true)}
              className="px-4 py-1.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
            >
              Publish Event
            </button>
          )}
        </div>
      </header>

      <PublishModal
        eventId={event.id}
        eventName={event.name}
        eventHash={event.event_hash}
        isAlreadyPublished={isPublished}
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
      />
    </>
  );
}
