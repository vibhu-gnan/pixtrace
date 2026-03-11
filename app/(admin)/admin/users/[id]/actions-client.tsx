'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleUserAdmin, changeUserPlan, adminSetCustomLimits } from '@/actions/admin';

interface UserAdminActionsProps {
  userId: string;
  isAdmin: boolean;
  currentPlan: string;
  customStorageLimitBytes: number | null;
  customMaxEvents: number | null;
  customFeatureFlags: Record<string, unknown> | null;
}

const PLANS = [
  { id: 'free', label: 'Free' },
  { id: 'starter', label: 'Starter' },
  { id: 'pro', label: 'Pro' },
  { id: 'enterprise', label: 'Enterprise' },
];

const FEATURE_FLAG_LABELS: Record<string, string> = {
  downloads: 'Downloads',
  custom_branding: 'Custom Branding',
  client_proofing: 'Client Proofing',
  api_access: 'API Access',
  white_label: 'White Label',
};

function bytesToGB(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes === 0) return '0';
  return (bytes / (1024 ** 3)).toFixed(1);
}

export function UserAdminActions({
  userId,
  isAdmin,
  currentPlan,
  customStorageLimitBytes,
  customMaxEvents,
  customFeatureFlags,
}: UserAdminActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);

  // Custom limits state
  const [storageGB, setStorageGB] = useState(bytesToGB(customStorageLimitBytes));
  const [maxEvents, setMaxEvents] = useState(
    customMaxEvents !== null && customMaxEvents !== undefined ? String(customMaxEvents) : ''
  );
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(() => {
    const flags: Record<string, boolean> = {};
    if (customFeatureFlags) {
      for (const key of Object.keys(FEATURE_FLAG_LABELS)) {
        flags[key] = !!customFeatureFlags[key];
      }
    }
    return flags;
  });
  const [showLimits, setShowLimits] = useState(false);

  const hasCustomOverrides = customStorageLimitBytes !== null || customMaxEvents !== null || customFeatureFlags !== null;

  const handleToggleAdmin = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await toggleUserAdmin(userId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleChangePlan = () => {
    if (selectedPlan === currentPlan) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await changeUserPlan(userId, selectedPlan);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Plan updated');
        router.refresh();
      }
    });
  };

  const handleSaveLimits = () => {
    setError(null);
    setSuccess(null);

    // Client-side NaN guard
    let parsedStorage: number | null = null;
    let parsedEvents: number | null = null;
    if (storageGB !== '') {
      const v = parseFloat(storageGB);
      if (Number.isNaN(v) || v < 0) {
        setError('Storage limit must be a valid non-negative number');
        return;
      }
      parsedStorage = v;
    }
    if (maxEvents !== '') {
      const v = parseInt(maxEvents, 10);
      if (Number.isNaN(v) || v < 0) {
        setError('Max events must be a valid non-negative number');
        return;
      }
      parsedEvents = v;
    }

    // Only send feature flags that are actually true (avoid saving all-false as "custom")
    const truthyFlags = Object.fromEntries(
      Object.entries(featureFlags).filter(([, v]) => v === true)
    );
    const flagsToSend = Object.keys(truthyFlags).length > 0 ? truthyFlags : null;

    startTransition(async () => {
      const result = await adminSetCustomLimits(userId, {
        customStorageLimitGB: parsedStorage,
        customMaxEvents: parsedEvents,
        customFeatureFlags: flagsToSend,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Custom limits saved');
        router.refresh();
      }
    });
  };

  const handleClearLimits = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await adminSetCustomLimits(userId, {
        customStorageLimitGB: null,
        customMaxEvents: null,
        customFeatureFlags: null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setStorageGB('');
        setMaxEvents('');
        setFeatureFlags({});
        setSuccess('Custom limits cleared — using plan defaults');
        router.refresh();
      }
    });
  };

  const toggleFeatureFlag = (key: string) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4 w-full">
      {/* Admin toggle + Plan change row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <button
          onClick={handleToggleAdmin}
          disabled={isPending}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            isAdmin
              ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          {isAdmin ? 'Remove Admin' : 'Make Admin'}
        </button>

        <div className="flex items-center gap-2">
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleChangePlan}
            disabled={isPending || selectedPlan === currentPlan}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Plan
          </button>
        </div>
      </div>

      {/* Enterprise Custom Limits */}
      {currentPlan === 'enterprise' && (
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLimits(!showLimits)}
            className="w-full px-4 py-3 flex items-center justify-between bg-amber-50 hover:bg-amber-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-800">Custom Enterprise Limits</span>
              {hasCustomOverrides && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-800">
                  Active
                </span>
              )}
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-amber-600 transition-transform ${showLimits ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showLimits && (
            <div className="p-4 space-y-4 bg-white border-t border-amber-200">
              {/* Storage + Events */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Storage Limit (GB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={storageGB}
                    onChange={(e) => setStorageGB(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    placeholder="Empty = plan default (unlimited)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Max Events
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={maxEvents}
                    onChange={(e) => setMaxEvents(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    placeholder="Empty = plan default (0 = unlimited)"
                  />
                </div>
              </div>

              {/* Feature Flags */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Feature Overrides</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(FEATURE_FLAG_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFeatureFlag(key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                        featureFlags[key]
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {featureFlags[key] ? '\u2713 ' : ''}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={handleSaveLimits}
                  disabled={isPending}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Limits'}
                </button>
                {hasCustomOverrides && (
                  <button
                    onClick={handleClearLimits}
                    disabled={isPending}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Clear Overrides
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </div>
  );
}
