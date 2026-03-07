import { getEventsPage } from '@/actions/events';
import { DashboardEventsClient } from '@/components/dashboard/dashboard-events-client';
import Link from 'next/link';

// ─── Filter Tabs ─────────────────────────────────────────────

const filterTabs = [
  { label: 'All Events', active: true },
  { label: 'Active', active: false },
  { label: 'Drafts', active: false },
  { label: 'Archived', active: false },
];

// ─── Page Component ──────────────────────────────────────────

export default async function DashboardPage() {
  const { events, hasMore } = await getEventsPage();

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.label}
              disabled={!tab.active}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                tab.active
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown (visual only) */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Sort by:</span>
          <button className="inline-flex items-center gap-1 font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            Newest First
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Event cards grid */}
      {events.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No events yet
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
            Create your first event to start uploading photos and sharing galleries
          </p>
          <Link
            href="/events/new"
            className="inline-flex items-center px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
          >
            Create Event
          </Link>
        </div>
      ) : (
        <DashboardEventsClient initialEvents={events} initialHasMore={hasMore} />
      )}
    </div>
  );
}
