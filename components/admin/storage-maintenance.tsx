'use client';

import { useState, useTransition } from 'react';
import { scanOrphanedR2, cleanOrphanedR2, type ScanResult } from '@/actions/admin';

interface StorageMaintenanceSectionProps {
  initialTrackedOrphanCount: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

export function StorageMaintenanceSection({ initialTrackedOrphanCount }: StorageMaintenanceSectionProps) {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cleanResult, setCleanResult] = useState<{
    deletedCount: number;
    cleanedTrackedCount: number;
    errors: string[];
  } | null>(null);
  const [confirmingClean, setConfirmingClean] = useState(false);

  const [isScanning, startScanTransition] = useTransition();
  const [isCleaning, startCleanTransition] = useTransition();

  const handleScan = () => {
    setScanError(null);
    setScanResult(null);
    setCleanResult(null);
    setConfirmingClean(false);

    startScanTransition(async () => {
      try {
        const result = await scanOrphanedR2();
        if (result.success) {
          setScanResult(result);
        } else {
          setScanError(result.error);
        }
      } catch (err: any) {
        setScanError(err?.message || 'Scan failed unexpectedly. Check server logs.');
      }
    });
  };

  const handleClean = () => {
    if (!scanResult) return;
    const { scanId } = scanResult;
    setConfirmingClean(false);

    startCleanTransition(async () => {
      try {
        const result = await cleanOrphanedR2(scanId);
        setCleanResult(result);
        // Clear scan result so they must re-scan before cleaning again
        setScanResult(null);
      } catch (err: any) {
        setCleanResult({
          deletedCount: 0,
          cleanedTrackedCount: 0,
          errors: [err?.message || 'Clean failed unexpectedly. Check server logs.'],
        });
        setScanResult(null);
      }
    });
  };

  const totalOrphansFound = scanResult
    ? scanResult.untrackedOrphanCount + scanResult.trackedOrphanCount
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Storage Maintenance
          </h3>
          {!scanResult && !isScanning && initialTrackedOrphanCount > 0 && !cleanResult && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {formatNumber(initialTrackedOrphanCount)} tracked orphans pending
            </span>
          )}
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning || isCleaning}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {isScanning ? 'Scanning...' : 'Scan for Orphans'}
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Scanning indicator */}
        {isScanning && (
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            Listing R2 objects and comparing with database... This may take a moment.
          </div>
        )}

        {/* Scan error */}
        {scanError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            <p className="font-medium">Scan failed</p>
            <p className="mt-1">{scanError}</p>
          </div>
        )}

        {/* Scan results */}
        {scanResult && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="px-3 py-2 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500">R2 Objects</p>
                <p className="text-lg font-semibold text-gray-900">{formatNumber(scanResult.r2ObjectCount)}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500">DB Keys</p>
                <p className="text-lg font-semibold text-gray-900">{formatNumber(scanResult.dbKeyCount)}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500">Tracked Orphans</p>
                <p className="text-lg font-semibold text-amber-600">{formatNumber(scanResult.trackedOrphanCount)}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500">Untracked Orphans</p>
                <p className="text-lg font-semibold text-red-600">{formatNumber(scanResult.untrackedOrphanCount)}</p>
              </div>
            </div>

            {totalOrphansFound === 0 ? (
              <div className="text-sm text-green-600 font-medium">
                No orphaned objects found. Storage is clean.
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {!confirmingClean ? (
                  <button
                    onClick={() => setConfirmingClean(true)}
                    disabled={isCleaning}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Clean {formatNumber(totalOrphansFound)} Orphans
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleClean}
                      disabled={isCleaning}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {isCleaning ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Cleaning...
                        </>
                      ) : (
                        'Confirm Delete'
                      )}
                    </button>
                    {!isCleaning && (
                      <button
                        onClick={() => setConfirmingClean(false)}
                        className="px-3 py-2 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </>
                )}
                <span className="text-xs text-gray-400">
                  Max {formatNumber(5000)} keys per run &middot; expires in 10 min
                </span>
              </div>
            )}
          </>
        )}

        {/* Cleaning indicator */}
        {isCleaning && (
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
            Deleting orphaned objects in batches...
          </div>
        )}

        {/* Clean result */}
        {cleanResult && (
          <div className={`rounded-lg border p-4 text-sm ${cleanResult.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <p className={`font-medium ${cleanResult.errors.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              Cleanup {cleanResult.errors.length > 0 ? 'completed with errors' : 'complete'}
            </p>
            <ul className="mt-1 space-y-0.5 text-gray-600">
              {cleanResult.deletedCount > 0 && (
                <li>Deleted {formatNumber(cleanResult.deletedCount)} untracked orphans from R2</li>
              )}
              {cleanResult.cleanedTrackedCount > 0 && (
                <li>Cleaned {formatNumber(cleanResult.cleanedTrackedCount)} tracked orphans</li>
              )}
              {cleanResult.deletedCount === 0 && cleanResult.cleanedTrackedCount === 0 && cleanResult.errors.length === 0 && (
                <li>No objects were deleted</li>
              )}
            </ul>
            {cleanResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-amber-600 cursor-pointer hover:underline">
                  {cleanResult.errors.length} error(s)
                </summary>
                <ul className="mt-1 text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                  {cleanResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Empty state when nothing has happened yet */}
        {!isScanning && !scanResult && !scanError && !cleanResult && !isCleaning && (
          <p className="text-sm text-gray-400">
            Scan to find R2 objects that no longer have matching database records.
          </p>
        )}
      </div>
    </div>
  );
}
