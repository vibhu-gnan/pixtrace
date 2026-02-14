'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EventData } from '@/actions/events';
import { deleteEvent } from '@/actions/events';

// ─── SVG Icons ───────────────────────────────────────────────

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// ─── Gradient Generator ──────────────────────────────────────

const gradientPairs = [
  ['#6366f1', '#8b5cf6'],  // indigo → violet
  ['#3b82f6', '#6366f1'],  // blue → indigo
  ['#ec4899', '#f43f5e'],  // pink → rose
  ['#f59e0b', '#ef4444'],  // amber → red
  ['#10b981', '#3b82f6'],  // emerald → blue
  ['#8b5cf6', '#ec4899'],  // violet → pink
  ['#06b6d4', '#6366f1'],  // cyan → indigo
  ['#f97316', '#f59e0b'],  // orange → amber
  ['#14b8a6', '#10b981'],  // teal → emerald
  ['#a855f7', '#6366f1'],  // purple → indigo
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getGradient(name: string): [string, string] {
  const index = hashString(name) % gradientPairs.length;
  return gradientPairs[index] as [string, string];
}

// ─── Event Card Component ────────────────────────────────────

interface EventCardProps {
  event: EventData;
}

export function EventCard({ event }: EventCardProps) {
  const [from, to] = getGradient(event.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : null;

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteEvent(event.id);
    } catch {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
    <Link
      href={`/events/${event.id}`}
      className="block rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-200 group"
    >
      {/* Cover image area */}
      <div
        className="relative h-48 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        {/* Status badge — top left */}
        <div className="absolute top-3 left-3 z-10">
          {event.is_public ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-green-700 backdrop-blur-sm shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              ACTIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-orange-600 backdrop-blur-sm shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              DRAFT
            </span>
          )}
        </div>

        {/* Action icons — top right */}
        <div
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.preventDefault()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => e.preventDefault()}
            className="p-1.5 rounded-full bg-white/80 text-gray-600 hover:bg-white backdrop-blur-sm transition-colors shadow-sm"
            aria-label="Share"
          >
            <ShareIcon />
          </button>
          <button
            onClick={(e) => e.preventDefault()}
            className="p-1.5 rounded-full bg-white/80 text-gray-600 hover:bg-white backdrop-blur-sm transition-colors shadow-sm"
            aria-label="More options"
          >
            <DotsIcon />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="p-1.5 rounded-full bg-white/80 text-red-500 hover:bg-red-50 hover:text-red-600 backdrop-blur-sm transition-colors shadow-sm"
            aria-label="Delete event"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Name overlay — bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12 bg-gradient-to-t from-black/60 to-transparent">
          <h3 className="text-white font-bold text-lg leading-tight truncate">
            {event.name}
          </h3>
          {event.description && (
            <p className="text-white/70 text-xs mt-0.5 truncate">
              {event.description}
            </p>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Date row */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <CalendarIcon className="text-gray-400 flex-shrink-0" />
          <span>{formattedDate || 'No date set'}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Photos</p>
            <p className="text-base font-bold text-gray-900">
              {formatCount(event.media_count || 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Views</p>
            <p className="text-base font-bold text-gray-900">&mdash;</p>
          </div>
        </div>
      </div>
    </Link>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-4">
            <p className="text-sm text-gray-700">
              Delete &quot;{event.name}&quot;? This will remove the event and all its photos. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(n);
}
