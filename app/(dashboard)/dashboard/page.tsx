import { getEventsPage, getDashboardStats } from '@/actions/events';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getOrganizerPlanLimits } from '@/lib/plans/limits';
import { DashboardEventsClient } from '@/components/dashboard/dashboard-events-client';
import { DashboardPageContent } from '@/components/dashboard/dashboard-page-content';
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: searchQuery } = await searchParams;
  const [{ events, hasMore }, organizer] = await Promise.all([
    getEventsPage(null, undefined, searchQuery),
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
    <DashboardPageContent
      stats={stats}
      events={events}
      hasMore={hasMore}
      searchQuery={searchQuery}
    />
  );
}
