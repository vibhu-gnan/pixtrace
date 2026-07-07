'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { PlanData } from '@/types';

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
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

interface PlanChangeDialogProps {
  open: boolean;
  onClose: () => void;
  currentPlan: PlanData;
  targetPlan: PlanData;
  isUpgrade: boolean;
  storageUsedBytes: number;
  eventCount: number;
  periodEnd: string | null;
  loading: boolean;
  onConfirm: () => void;
}

export function PlanChangeDialog({
  open,
  onClose,
  currentPlan,
  targetPlan,
  isUpgrade,
  storageUsedBytes,
  eventCount,
  periodEnd,
  loading,
  onConfirm,
}: PlanChangeDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !loading) onClose();
  };

  // Compute feature differences
  const currentFeatures = new Set(currentPlan.features || []);
  const targetFeatures = new Set(targetPlan.features || []);
  const gained = (targetPlan.features || []).filter((f) => !currentFeatures.has(f));
  const lost = (currentPlan.features || []).filter((f) => !targetFeatures.has(f));

  // Storage/event impact for downgrades
  const storageOverTarget = targetPlan.storage_limit_bytes > 0 && storageUsedBytes > targetPlan.storage_limit_bytes;
  const eventsOverTarget = targetPlan.max_events > 0 && eventCount > targetPlan.max_events;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className={`px-6 py-5 flex items-center gap-3 ${isUpgrade ? 'bg-blue-50' : 'bg-amber-50'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isUpgrade ? 'bg-blue-100' : 'bg-amber-100'
          }`}>
            {isUpgrade ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isUpgrade ? 'text-blue-900' : 'text-amber-900'}`}>
              {isUpgrade ? `Upgrade to ${targetPlan.name}` : `Switch to ${targetPlan.name}`}
            </h3>
            <p className={`text-sm mt-0.5 ${isUpgrade ? 'text-blue-700' : 'text-amber-700'}`}>
              {isUpgrade
                ? `${formatAmount(currentPlan.price_monthly)}/mo → ${formatAmount(targetPlan.price_monthly)}/mo`
                : `${formatAmount(currentPlan.price_monthly)}/mo → ${targetPlan.price_monthly === 0 ? 'Free' : `${formatAmount(targetPlan.price_monthly)}/mo`}`
              }
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Features gained */}
          {gained.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                {isUpgrade ? 'What you get' : 'Features included'}
              </p>
              <ul className="space-y-1">
                {gained.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-green-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Features lost (downgrades) */}
          {!isUpgrade && lost.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Features you&apos;ll lose
              </p>
              <ul className="space-y-1">
                {lost.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-red-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Storage/event warnings for downgrades */}
          {!isUpgrade && (storageOverTarget || eventsOverTarget) && (
            <div className="bg-red-50 rounded-lg p-3 border border-red-100 space-y-2">
              {storageOverTarget && (
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Storage:</span> You&apos;re using {formatBytes(storageUsedBytes)} but the {targetPlan.name} plan includes only {formatBytes(targetPlan.storage_limit_bytes)}.
                  You&apos;ll have a 30-day grace period to reduce your usage.
                </p>
              )}
              {eventsOverTarget && (
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Events:</span> You have {eventCount} events but the {targetPlan.name} plan allows only {targetPlan.max_events}.
                  Existing events won&apos;t be deleted, but you won&apos;t be able to create new ones.
                </p>
              )}
            </div>
          )}

          {/* Timing info */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            {isUpgrade ? (
              <p className="text-sm text-gray-600">
                Changes take effect <span className="font-semibold text-gray-800">immediately</span>.
                Razorpay will prorate the difference for the remainder of your billing period.
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Changes take effect at the <span className="font-semibold text-gray-800">end of your current billing period</span>
                {periodEnd ? ` (${formatDate(periodEnd)})` : ''}.
                You&apos;ll keep full access to your current plan until then.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold text-center rounded-lg text-white transition-colors shadow-sm disabled:opacity-50 ${
              isUpgrade
                ? 'bg-brand-500 hover:bg-brand-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {loading
              ? 'Processing...'
              : isUpgrade
                ? `Upgrade to ${targetPlan.name}`
                : `Switch to ${targetPlan.name}`
            }
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
