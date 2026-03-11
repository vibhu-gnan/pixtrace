import { getAdminStats, getStorageMaintenanceStats } from '@/actions/admin';
import { StatsCard } from '@/components/admin/stats-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { StorageMaintenanceSection } from '@/components/admin/storage-maintenance';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const tb = bytes / (1024 ** 4);
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── SVG Icons for stat cards ────────────────────────────────

function UsersStatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CalendarStatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ImageStatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function DatabaseStatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

const FACE_JOB_COLORS: Record<string, string> = {
  pending: 'bg-yellow-400',
  processing: 'bg-blue-400',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  no_faces: 'bg-gray-400',
};

export default async function AdminOverviewPage() {
  const [stats, storageStats] = await Promise.all([
    getAdminStats(),
    getStorageMaintenanceStats(),
  ]);

  const totalFaceJobs = Object.values(stats.faceJobCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>

      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={<UsersStatIcon />}
        />
        <StatsCard
          title="Total Events"
          value={stats.totalEvents.toLocaleString()}
          icon={<CalendarStatIcon />}
        />
        <StatsCard
          title="Total Media"
          value={stats.totalMedia.toLocaleString()}
          icon={<ImageStatIcon />}
        />
        <StatsCard
          title="Platform Storage"
          value={formatBytes(stats.totalStorageBytes)}
          icon={<DatabaseStatIcon />}
        />
      </div>

      {/* Row 2: Revenue metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Active Subscriptions"
          value={Object.values(stats.subsByPlan).reduce((a, b) => a + b, 0)}
          subtitle={Object.entries(stats.subsByPlan)
            .map(([plan, count]) => `${plan}: ${count}`)
            .join(' | ') || 'No active subscriptions'}
        />
        <StatsCard
          title="Total Revenue"
          value={formatAmount(stats.totalRevenue)}
          subtitle="All captured payments"
        />
        <StatsCard
          title="Monthly Recurring"
          value={formatAmount(stats.mrr)}
          subtitle="Based on active subscriptions"
        />
      </div>

      {/* Row 3: Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Signups */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Signups</h3>
          </div>
          {stats.recentUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No users yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.recentUsers.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={user.plan_id || 'free'} />
                    <span className="text-xs text-gray-400">{formatDate(user.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Events</h3>
          </div>
          {stats.recentEvents.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No events yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.recentEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{event.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {event.organizers?.name || event.organizers?.email || '—'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(event.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Face Processing Queue */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Face Processing Queue
            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
              {totalFaceJobs.toLocaleString()} total jobs
            </span>
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {Object.entries(stats.faceJobCounts).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${FACE_JOB_COLORS[status] || 'bg-gray-400'}`} />
                <span className="text-sm capitalize text-gray-600">{status.replace('_', ' ')}</span>
                <span className="text-sm font-semibold text-gray-900 ml-auto">{count}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {totalFaceJobs > 0 && (
            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
              {Object.entries(stats.faceJobCounts).map(([status, count]) => {
                const pct = (count / totalFaceJobs) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={status}
                    className={`${FACE_JOB_COLORS[status] || 'bg-gray-400'} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${status}: ${count}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Storage Maintenance */}
      <StorageMaintenanceSection initialTrackedOrphanCount={storageStats.trackedOrphanCount} />
    </div>
  );
}
