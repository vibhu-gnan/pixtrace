import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminUserDetail } from '@/actions/admin';
import { StatusBadge } from '@/components/admin/status-badge';
import { UserAdminActions } from './actions-client';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await getAdminUserDetail(id);

  if (!data) notFound();

  const { user, events, subscriptions, payments } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back link */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeftIcon />
        Back to Users
      </Link>

      {/* User profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center">
                <span className="text-xl font-bold text-white">
                  {(user.name || user.email)?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {user.name || user.email.split('@')[0]}
              </h1>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <StatusBadge status={user.plan_id} />
                {user.is_admin && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          <UserAdminActions userId={user.id} isAdmin={user.is_admin} currentPlan={user.plan_id} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Storage Used</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatBytes(user.storage_used_bytes)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Events</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{events.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Joined</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatDate(user.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Razorpay ID</p>
            <p className="text-sm font-mono text-gray-600 mt-0.5 truncate">
              {user.razorpay_customer_id || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Events ({events.length})
          </h3>
        </div>
        {events.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No events created.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Photos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Public</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Face Search</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event: any) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{event.name}</td>
                    <td className="px-6 py-4 text-gray-500">{event.media_count}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={event.is_public ? 'enabled' : 'disabled'} label={event.is_public ? 'Public' : 'Private'} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={event.face_search_enabled ? 'enabled' : 'disabled'}
                        label={event.face_search_enabled ? 'On' : 'Off'}
                      />
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(event.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Subscriptions ({subscriptions.length})
          </h3>
        </div>
        {subscriptions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No subscriptions.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Razorpay ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscriptions.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{sub.plans?.name || sub.plan_id}</td>
                    <td className="px-6 py-4"><StatusBadge status={sub.status} /></td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(sub.current_period_start)} – {formatDate(sub.current_period_end)}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-gray-400 truncate max-w-[200px]">
                      {sub.razorpay_subscription_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Payment History ({payments.length})
          </h3>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No payments.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment: any) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-700">{formatDate(payment.paid_at || payment.created_at)}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{formatAmount(payment.amount)}</td>
                    <td className="px-6 py-4 text-gray-500 capitalize">{payment.method || '—'}</td>
                    <td className="px-6 py-4"><StatusBadge status={payment.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
