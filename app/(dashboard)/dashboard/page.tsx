import { getEventsPage, getDashboardStats } from '@/actions/events';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getOrganizerPlanLimits } from '@/lib/plans/limits';
import { DashboardEventsClient } from '@/components/dashboard/dashboard-events-client';
import Link from 'next/link';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export default async function DashboardPage() {
  const [{ events, hasMore }, organizer] = await Promise.all([
    getEventsPage(),
    getCurrentOrganizer(),
  ]);

  // Fetch accurate aggregate stats (not from paginated events array)
  const [planLimits, dashStats] = organizer
    ? await Promise.all([
        getOrganizerPlanLimits(organizer.id),
        getDashboardStats(organizer.id),
      ])
    : [null, { totalPhotos: 0, totalViews: 0 }];

  const { totalPhotos, totalViews } = dashStats;

  const stats = [
    {
      label: 'Events',
      value: String(planLimits?.eventCount ?? events.length),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      color: 'bg-brand-100 text-brand-600',
    },
    {
      label: 'Photos',
      value: formatCount(totalPhotos),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Views',
      value: formatCount(totalViews),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      color: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Storage',
      value: planLimits ? formatBytes(planLimits.storageUsedBytes) : '—',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      ),
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div>
      {/* Stats Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">{stat.value}</p>
              <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">My Events</h2>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No events yet</h3>
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
