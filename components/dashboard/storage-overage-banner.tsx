'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlanLimits } from '@/lib/plans/limits';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

interface StorageOverageBannerProps {
  planLimits: PlanLimits;
}

export function StorageOverageBanner({ planLimits }: StorageOverageBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!planLimits.isOverLimit || !planLimits.storageGraceDeadline || dismissed) {
    return null;
  }

  const days = planLimits.graceDaysRemaining ?? 0;
  const isExpired = days <= 0;
  const isFinalDay = days === 1;
  const isUrgent = days <= 7;

  const usedDisplay = formatBytes(planLimits.storageUsedBytes);
  const limitDisplay = formatBytes(planLimits.storageLimitBytes);
  const overByBytes = planLimits.storageUsedBytes - planLimits.storageLimitBytes;
  const overByDisplay = formatBytes(overByBytes);

  const deadlineDate = new Date(planLimits.storageGraceDeadline).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Color scheme: red for urgent/expired, amber for warning
  const bgColor = isUrgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const textColor = isUrgent ? 'text-red-800' : 'text-amber-800';
  const iconColor = isUrgent ? 'text-red-500' : 'text-amber-500';
  const subTextColor = isUrgent ? 'text-red-600' : 'text-amber-600';

  return (
    <div className={`relative rounded-xl border ${bgColor} p-4 mb-4`}>
      {/* Dismiss button (session only) — never show on final day or expired */}
      {!isExpired && !isFinalDay && (
        <button
          onClick={() => setDismissed(true)}
          className={`absolute top-3 right-3 ${subTextColor} hover:opacity-70 transition-opacity`}
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}

      <div className="flex gap-3">
        {/* Warning icon */}
        <div className={`shrink-0 mt-0.5 ${iconColor}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="flex-1 min-w-0 pr-6">
          {/* Heading */}
          <p className={`text-sm font-semibold ${textColor}`}>
            {isExpired
              ? 'Storage grace period expired'
              : isFinalDay
                ? 'FINAL WARNING: Your content will be deleted tomorrow'
                : isUrgent
                  ? `Storage grace period expires in ${days} day${days !== 1 ? 's' : ''}`
                  : 'You\u2019re over your storage limit'}
          </p>

          {/* Description */}
          <p className={`text-xs mt-1 ${subTextColor}`}>
            {isExpired ? (
              <>
                You&apos;re using {usedDisplay} of your {limitDisplay} limit (over by {overByDisplay}).
                Excess content will be cleaned up automatically, starting with the oldest events.
                Upgrade your plan now to prevent data loss.
              </>
            ) : isFinalDay ? (
              <>
                You&apos;re using {usedDisplay} of your {limitDisplay} limit (over by {overByDisplay}).
                Your oldest events will be <strong>permanently deleted tomorrow</strong> ({deadlineDate}) unless you upgrade or free up space now.
              </>
            ) : isUrgent ? (
              <>
                You&apos;re using {usedDisplay} of your {limitDisplay} limit (over by {overByDisplay}).
                After {deadlineDate}, your oldest events will be automatically deleted until usage is within your limit.
                Upgrade or delete content to prevent data loss.
              </>
            ) : (
              <>
                You&apos;re using {usedDisplay} of your {limitDisplay} limit (over by {overByDisplay}).
                Your content will remain active for {days} more day{days !== 1 ? 's' : ''} (until {deadlineDate}).
                After that, oldest events will be deleted automatically if you&apos;re still over the limit.
              </>
            )}
          </p>

          {/* Safety message for final day and expired */}
          {(isFinalDay || isExpired) && (
            <p className={`text-xs mt-2 ${subTextColor} opacity-80`}>
              If you&apos;ve already upgraded, the system will detect it automatically and your content will be safe.
              Questions? Contact <a href="mailto:support@pixtrace.in" className="underline">support@pixtrace.in</a>
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-3">
            <Link
              href="/pricing"
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors ${
                isUrgent
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-amber-600 text-white hover:bg-amber-500'
              }`}
            >
              Upgrade Plan
            </Link>
            <Link
              href="/dashboard"
              className={`text-xs font-medium ${subTextColor} hover:underline`}
            >
              Manage Content
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
