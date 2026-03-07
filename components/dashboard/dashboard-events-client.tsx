'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EventCard } from './event-card';
import { CreateEventCard } from './create-event-card';
import { getEventsPage } from '@/actions/events';
import type { EventData } from '@/actions/events';

const MAX_FAILURES = 3;

interface DashboardEventsClientProps {
  initialEvents: EventData[];
  initialHasMore: boolean;
}

export function DashboardEventsClient({ initialEvents, initialHasMore }: DashboardEventsClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const eventsRef = useRef(initialEvents);
  const failureCountRef = useRef(0);

  // Sync props on server refresh (e.g. after event creation/deletion)
  useEffect(() => {
    setEvents(initialEvents);
    setHasMore(initialHasMore);
    hasMoreRef.current = initialHasMore;
    eventsRef.current = initialEvents;
    failureCountRef.current = 0;
    setError(null);
  }, [initialEvents, initialHasMore]);

  // Keep ref in sync with state
  useEffect(() => { eventsRef.current = events; }, [events]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current || failureCountRef.current >= MAX_FAILURES) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const currentEvents = eventsRef.current;
      const lastEvent = currentEvents[currentEvents.length - 1];
      const cursor = lastEvent?.created_at || null;
      const { events: newEvents, hasMore: more } = await getEventsPage(cursor);

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const unique = newEvents.filter((e) => !existingIds.has(e.id));
        const next = [...prev, ...unique];
        eventsRef.current = next;
        return next;
      });
      hasMoreRef.current = more;
      setHasMore(more);
      failureCountRef.current = 0;
    } catch (err) {
      failureCountRef.current++;
      console.error('Failed to load more events:', err);
      if (failureCountRef.current >= MAX_FAILURES) {
        setError('Failed to load more events.');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []); // No deps — reads all state from refs

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // Intersection observer — created once
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadMoreRef.current();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (events.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
        <CreateEventCard />
      </div>

      {/* Sentinel — always rendered when hasMore, hidden class prevents layout shift */}
      <div
        ref={sentinelRef}
        className={hasMore ? 'flex items-center justify-center py-8' : 'hidden'}
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading more events...
          </div>
        )}
        {error && (
          <button
            onClick={() => { failureCountRef.current = 0; setError(null); loadMoreRef.current(); }}
            className="text-sm text-red-500 hover:text-red-600 underline"
          >
            {error} Tap to retry.
          </button>
        )}
      </div>
    </>
  );
}
