'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { StorageLimitInfo } from '@/lib/upload/upload-manager';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface StorageLimitModalProps {
  info: StorageLimitInfo;
  onClose: () => void;
}

export function StorageLimitModal({ info, onClose }: StorageLimitModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const hasDetailedInfo = info.storageLimitBytes > 0;
  const usedPercent = hasDetailedInfo
    ? Math.min(100, Math.round((info.storageUsedBytes / info.storageLimitBytes) * 100))
    : 0;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Red header */}
        <div className="bg-red-50 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900">Storage Limit Reached</h3>
            <p className="text-sm text-red-700 mt-0.5">
              Your {info.planName || 'current'} plan storage is full
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Progress bar (if we have detailed info) */}
          {hasDetailedInfo && (
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-600 font-medium">
                  {formatBytes(info.storageUsedBytes)} used
                </span>
                <span className="text-gray-500">
                  {formatBytes(info.storageLimitBytes)} limit
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-red-500 transition-all"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{usedPercent}% used</p>
            </div>
          )}

          <p className="text-sm text-gray-600">
            {info.reason || 'You have reached the storage limit for your plan. Upgrade to get more storage and continue uploading.'}
          </p>

          {/* Plan upgrade options */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Upgrade for more storage
            </p>
            <div className="space-y-1.5 text-sm text-gray-600">
              {info.planId === 'free' && (
                <>
                  <div className="flex justify-between">
                    <span>Starter</span>
                    <span className="font-medium text-gray-900">10 GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pro</span>
                    <span className="font-medium text-gray-900">50 GB</span>
                  </div>
                </>
              )}
              {info.planId === 'starter' && (
                <div className="flex justify-between">
                  <span>Pro</span>
                  <span className="font-medium text-gray-900">50 GB</span>
                </div>
              )}
              {(info.planId === 'pro' || !info.planId) && (
                <div className="flex justify-between">
                  <span>Enterprise</span>
                  <span className="font-medium text-gray-900">Unlimited</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <Link
            href="/pricing"
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-center rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-sm"
          >
            Upgrade Plan
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
