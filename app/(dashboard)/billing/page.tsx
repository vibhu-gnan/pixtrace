import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSubscriptionDetails } from '@/actions/billing';
import { getOrganizerPlanLimits } from '@/lib/plans/limits';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { CancelSubscriptionButton } from './cancel-button';

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
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  free: 'bg-slate-700 text-slate-300',
  starter: 'bg-blue-900/60 text-blue-300',
  pro: 'bg-primary/20 text-primary',
  enterprise: 'bg-purple-900/50 text-purple-300',
};

export default async function BillingPage() {
  const organizer = await getCurrentOrganizer();
  if (!organizer) redirect('/sign-in');

  const [details, planLimits] = await Promise.all([
    getSubscriptionDetails(),
    getOrganizerPlanLimits(organizer.id),
  ]);

  if (!details) redirect('/sign-in');

  const { plan, subscription, payments } = details;

  const storagePercent = planLimits.storageLimitBytes > 0
    ? Math.min(100, Math.round((planLimits.storageUsedBytes / planLimits.storageLimitBytes) * 100))
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>

      {/* Current Plan Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Current Plan</p>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{plan?.name || 'Free'}</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_BADGE_COLORS[organizer.plan_id] || PLAN_BADGE_COLORS.free}`}>
                {organizer.plan_id.toUpperCase()}
              </span>
            </div>
            {plan?.price_monthly ? (
              <p className="text-gray-500 mt-1">{formatAmount(plan.price_monthly)}/month</p>
            ) : (
              <p className="text-gray-500 mt-1">Free forever</p>
            )}
          </div>
          {organizer.plan_id !== 'enterprise' && (
            <Link
              href="/pricing"
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              {organizer.plan_id === 'free' ? 'Upgrade Plan' : 'Change Plan'}
            </Link>
          )}
        </div>
      </div>

      {/* Subscription Status */}
      {subscription && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Subscription</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Status</p>
              <p className={`font-semibold mt-0.5 capitalize ${
                subscription.status === 'active' ? 'text-green-600'
                : subscription.status === 'halted' ? 'text-orange-500'
                : 'text-gray-700'
              }`}>
                {subscription.cancel_at_period_end ? 'Cancels at period end' : subscription.status}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Current Period</p>
              <p className="font-medium text-gray-800 mt-0.5">
                {formatDate(subscription.current_period_start)} – {formatDate(subscription.current_period_end)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Next Billing Date</p>
              <p className="font-medium text-gray-800 mt-0.5">
                {subscription.cancel_at_period_end ? 'Won\'t renew' : formatDate(subscription.current_period_end)}
              </p>
            </div>
          </div>

          {subscription.status === 'active' && !subscription.cancel_at_period_end && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <CancelSubscriptionButton />
            </div>
          )}

          {subscription.cancel_at_period_end && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-orange-600">
                Your subscription will end on {formatDate(subscription.current_period_end)}. You&apos;ll be moved to the Free plan after that.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Storage Usage */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Storage Usage</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{formatBytes(planLimits.storageUsedBytes)} used</span>
            <span className="text-gray-500">
              {planLimits.storageLimitBytes > 0 ? `${formatBytes(planLimits.storageLimitBytes)} total` : 'Unlimited'}
            </span>
          </div>
          {planLimits.storageLimitBytes > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${storagePercent >= 90 ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          )}
          <p className="text-xs text-gray-400">
            {planLimits.maxEvents === 0
              ? 'Unlimited events'
              : `${planLimits.eventCount} of ${planLimits.maxEvents} events used`}
          </p>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment History</h3>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No payments yet.
          </div>
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
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        payment.status === 'captured' ? 'bg-green-100 text-green-700' :
                        payment.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
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
