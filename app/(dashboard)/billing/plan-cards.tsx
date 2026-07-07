'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRazorpayCheckout } from '@/components/pricing/razorpay-checkout';
import { cancelSubscription, cancelHaltedSubscription } from '@/actions/billing';
import { PlanChangeDialog } from './plan-change-dialog';
import type { PlanData, SubscriptionData } from '@/types';

const PLAN_SORT_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return 'Unlimited';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(0)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatAmount(paise: number): string {
  if (paise === 0) return 'Free';
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

interface PlanCardsProps {
  plans: PlanData[];
  currentPlanId: string;
  /** The organizer's own current plan row, even if it's since been deactivated in the catalog. */
  currentPlanData: PlanData | null;
  subscription: SubscriptionData | null;
  storageUsedBytes: number;
  eventCount: number;
}

export function PlanCards({ plans, currentPlanId, currentPlanData, subscription, storageUsedBytes, eventCount }: PlanCardsProps) {
  const router = useRouter();
  const { openCheckout } = useRazorpayCheckout();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialogTarget, setDialogTarget] = useState<PlanData | null>(null);
  const [dialogType, setDialogType] = useState<'upgrade' | 'downgrade'>('upgrade');
  const [undoingChange, setUndoingChange] = useState(false);
  const [haltedRecovering, setHaltedRecovering] = useState(false);

  // Enterprise users: no self-service
  if (currentPlanId === 'enterprise') {
    return (
      <div className="bg-purple-50 rounded-xl border border-purple-200 p-6 text-center">
        <p className="text-sm text-purple-800 font-medium">
          Your Enterprise plan is managed by your account manager.
        </p>
        <p className="text-xs text-purple-600 mt-1">
          Contact support for plan changes.
        </p>
      </div>
    );
  }

  const isHalted = subscription?.status === 'halted';
  const isPending = subscription?.status === 'pending';
  const isCancelPending = subscription?.cancel_at_period_end === true;
  const hasPendingChange = !!subscription?.pending_plan_id;
  const isDisabled = loading || isPending || hasPendingChange;

  // is_active-filtered catalog may not contain the organizer's own plan
  // (e.g. a deactivated/legacy plan) — fall back to the plan row we already
  // have so the confirm dialog never silently fails to open.
  const currentPlan = plans.find((p) => p.id === currentPlanId) || currentPlanData || undefined;
  const currentOrder = PLAN_SORT_ORDER[currentPlanId] ?? 0;

  const handleReactivate = async (targetPlanId: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await openCheckout(targetPlanId);
      if (result.success) {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleHaltedRecovery = async () => {
    setHaltedRecovering(true);
    setError('');
    try {
      const result = await cancelHaltedSubscription();
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to recover subscription');
    } finally {
      setHaltedRecovering(false);
    }
  };

  const handleUndoScheduledChange = async () => {
    setUndoingChange(true);
    setError('');
    try {
      const res = await fetch('/api/subscription/undo-change', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to undo the scheduled change');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to undo the scheduled change');
    } finally {
      setUndoingChange(false);
    }
  };

  const handleAction = async (targetPlan: PlanData) => {
    // Cancel-pending: every plan choice re-subscribes via a fresh checkout
    // (the old subscription stays paid through period end; the new one is
    // deferred to start right after it, so there's no double-charge and no
    // dead-end upgrade/downgrade path).
    if (isCancelPending) {
      if (targetPlan.id === 'free') return;
      await handleReactivate(targetPlan.id);
      return;
    }

    // Paid → free: use cancel flow with confirmation. Checked before the
    // free/no-subscription branch below so a Free click always routes
    // through cancellation, never through checkout with planId 'free'.
    if (targetPlan.id === 'free') {
      setDialogTarget(targetPlan);
      setDialogType('downgrade');
      return;
    }

    const targetOrder = PLAN_SORT_ORDER[targetPlan.id] ?? 0;
    const isUpgrade = targetOrder > currentOrder;

    // Free → paid: open Razorpay checkout (new subscription)
    if (!subscription || currentPlanId === 'free') {
      await handleReactivate(targetPlan.id);
      return;
    }

    // Paid → paid: show confirmation dialog
    setDialogTarget(targetPlan);
    setDialogType(isUpgrade ? 'upgrade' : 'downgrade');
  };

  const handleDialogConfirm = async () => {
    if (!dialogTarget) return;
    setLoading(true);
    setError('');

    try {
      if (dialogTarget.id === 'free') {
        // Downgrade to free = cancel subscription
        const result = await cancelSubscription();
        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }
      } else {
        // Paid-to-paid: call update API
        const res = await fetch('/api/subscription/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetPlanId: dialogTarget.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to change plan');
          setLoading(false);
          return;
        }
      }

      setDialogTarget(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Filter out enterprise from selectable plans (contact sales only)
  const selectablePlans = plans.filter((p) => p.id !== 'enterprise');
  const enterprisePlan = plans.find((p) => p.id === 'enterprise');
  const catalogFailedToLoad = plans.length === 0;

  return (
    <div className="space-y-4">
      {/* Status banners */}
      {isHalted && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4 space-y-2">
          <p className="text-sm font-medium text-red-800">
            Payment failed. Your subscription needs to be restarted to continue.
          </p>
          <button
            onClick={handleHaltedRecovery}
            disabled={haltedRecovering}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {haltedRecovering ? 'Processing...' : 'Fix payment & re-subscribe'}
          </button>
        </div>
      )}
      {isPending && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800">
            Your payment is being processed. Plan changes are temporarily unavailable.
          </p>
        </div>
      )}
      {hasPendingChange && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-medium text-blue-800">
            A plan change to {plans.find((p) => p.id === subscription?.pending_plan_id)?.name || subscription?.pending_plan_id} is scheduled for the end of your billing period.
          </p>
          <button
            onClick={handleUndoScheduledChange}
            disabled={undoingChange}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {undoingChange ? 'Undoing...' : 'Undo'}
          </button>
        </div>
      )}
      {isCancelPending && !hasPendingChange && (
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <p className="text-sm font-medium text-orange-800">
            Your subscription is set to cancel. Re-subscribe to any plan below to keep your access.
          </p>
        </div>
      )}
      {catalogFailedToLoad && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm font-medium text-red-800">
            Couldn&apos;t load plan options right now. Please refresh the page or try again shortly.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {selectablePlans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const targetOrder = PLAN_SORT_ORDER[plan.id] ?? 0;
          const isUpgrade = targetOrder > currentOrder;
          const isPendingTarget = subscription?.pending_plan_id === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-5 transition-all ${
                isCurrent
                  ? 'border-brand-300 bg-brand-50/30 ring-1 ring-brand-200'
                  : isPendingTarget
                    ? 'border-blue-300 bg-blue-50/30'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Labels */}
              {isCurrent && (
                <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 text-xs font-semibold bg-brand-500 text-white rounded-full">
                  Current Plan
                </span>
              )}
              {isPendingTarget && (
                <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 text-xs font-semibold bg-blue-500 text-white rounded-full">
                  Switching Soon
                </span>
              )}
              {plan.id === 'pro' && !isCurrent && !isPendingTarget && (
                <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 text-xs font-semibold bg-amber-500 text-white rounded-full">
                  Most Popular
                </span>
              )}

              <div className="pt-1">
                <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {formatAmount(plan.price_monthly)}
                  {plan.price_monthly > 0 && <span className="text-sm font-normal text-gray-500">/month</span>}
                </p>

                {/* Limits */}
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p>{plan.storage_limit_bytes > 0 ? formatBytes(plan.storage_limit_bytes) : 'Unlimited'} storage</p>
                  <p>{plan.max_events > 0 ? `${plan.max_events} events` : 'Unlimited events'}</p>
                </div>

                {/* Features */}
                {plan.features && plan.features.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 flex-shrink-0 mt-0.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Action button */}
                <div className="mt-4">
                  {isPendingTarget ? (
                    <div className="w-full py-2 text-center text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
                      Switching at period end
                    </div>
                  ) : isCancelPending ? (
                    plan.id === 'free' ? (
                      <div className="w-full py-2 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
                        Ends at period end
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAction(plan)}
                        disabled={isDisabled || isHalted}
                        className="w-full py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-brand-500 text-white hover:bg-brand-600"
                      >
                        {loading ? 'Processing...' : `Re-subscribe to ${plan.name}`}
                      </button>
                    )
                  ) : isCurrent ? (
                    <div className="w-full py-2 text-center text-sm font-medium text-brand-600 bg-brand-50 rounded-lg">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAction(plan)}
                      disabled={isDisabled || isHalted}
                      className={`w-full py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isUpgrade
                          ? 'bg-brand-500 text-white hover:bg-brand-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                    >
                      {loading ? 'Processing...' : isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      {enterprisePlan && currentPlanId !== 'enterprise' && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="font-semibold text-gray-900">Need more?</h4>
            <p className="text-sm text-gray-600 mt-0.5">
              Unlimited storage, white-label, dedicated account manager, and API access.
            </p>
          </div>
          <Link
            href="/enterprise"
            className="px-4 py-2 text-sm font-semibold text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors"
          >
            Contact Sales
          </Link>
        </div>
      )}

      {/* Plan change confirmation dialog */}
      {dialogTarget && currentPlan && (
        <PlanChangeDialog
          open={!!dialogTarget}
          onClose={() => { if (!loading) setDialogTarget(null); }}
          currentPlan={currentPlan}
          targetPlan={dialogTarget}
          isUpgrade={dialogType === 'upgrade'}
          storageUsedBytes={storageUsedBytes}
          eventCount={eventCount}
          periodEnd={subscription?.current_period_end || null}
          loading={loading}
          onConfirm={handleDialogConfirm}
        />
      )}
    </div>
  );
}
