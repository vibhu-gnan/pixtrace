'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlbumData } from '@/actions/albums';

// ── Types ────────────────────────────────────────────────────

type ImportState =
  | 'input'
  | 'scanning'
  | 'preview'
  | 'importing'
  | 'complete'
  | 'cancelled'
  | 'error';

type ImportMode = 'flat' | 'folder_to_album';

interface FolderInfo {
  name: string;
  path: string;
  fileCount: number;
}

interface ScanResult {
  folderName: string;
  folderId: string;
  resourceKey: string | null;
  totalImages: number;
  totalSkipped: number;
  estimatedSize: number;
  rootFileCount: number;
  truncated?: boolean;
  folders: FolderInfo[];
}

interface ImportProgress {
  status: string;
  total_files: number;
  completed: number;
  failed: number;
  skipped: number;
  error_message: string | null;
}

interface ImportTabProps {
  eventId: string;
  albums: AlbumData[];
  onImportComplete?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ── Component ────────────────────────────────────────────────

export function ImportTab({ eventId, albums, onImportComplete }: ImportTabProps) {
  const [state, setState] = useState<ImportState>('input');
  const [driveUrl, setDriveUrl] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('flat');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [useNewAlbum, setUseNewAlbum] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const unmountedRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // ── Poll with adaptive interval ─────────────────────────────

  // Max polls: 5 fast (1s) + 355 slow (5s) = ~30 minutes total
  const MAX_POLL_COUNT = 360;

  const schedulePoll = useCallback((id: string) => {
    const count = pollCountRef.current;

    // Give up after 30 minutes of polling
    if (count >= MAX_POLL_COUNT) {
      setError('Import is taking too long. Check back later or try again.');
      setState('error');
      return;
    }

    // Fast initial polls (1s for first 5), then slow down to 5s
    const interval = count < 5 ? 1000 : 5000;

    pollRef.current = setTimeout(async () => {
      if (unmountedRef.current) return; // Stop polling if component unmounted
      try {
        const statusRes = await fetch(`/api/import/status?jobId=${id}`);
        if (unmountedRef.current) return;
        const statusData = await statusRes.json();

        if (!statusRes.ok) {
          pollCountRef.current++;
          schedulePoll(id);
          return;
        }

        setProgress(statusData);

        if (statusData.status === 'completed') {
          setState('complete');
          return;
        }
        if (statusData.status === 'cancelled') {
          setState('cancelled');
          return;
        }
        if (statusData.status === 'failed') {
          setError(statusData.error_message || 'Import failed');
          setState('error');
          return;
        }

        // Still in progress — schedule next poll
        pollCountRef.current++;
        if (!unmountedRef.current) schedulePoll(id);
      } catch {
        // Network error — retry (unless unmounted)
        if (unmountedRef.current) return;
        pollCountRef.current++;
        schedulePoll(id);
      }
    }, interval);
  }, []);

  // ── Scan folder ────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    if (!driveUrl.trim()) return;

    setState('scanning');
    setError(null);

    try {
      const res = await fetch('/api/import/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', driveUrl, eventId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to scan folder');
        setState('error');
        return;
      }

      setScanResult(data);
      setNewAlbumName(data.folderName);
      setState('preview');
    } catch {
      setError('Network error while scanning folder');
      setState('error');
    }
  }, [driveUrl, eventId]);

  // ── Start import ───────────────────────────────────────────

  const handleStartImport = useCallback(async () => {
    if (!scanResult) return;

    setState('importing');
    setError(null);
    pollCountRef.current = 0;

    try {
      const body: Record<string, unknown> = {
        action: 'start',
        driveUrl,
        eventId,
        importMode,
        totalFiles: scanResult.totalImages, // Pass from scan — no double listing
      };

      if (importMode === 'flat') {
        if (useNewAlbum) {
          body.newAlbumName = newAlbumName || scanResult.folderName;
        } else {
          body.albumId = selectedAlbumId;
        }
      }

      const res = await fetch('/api/import/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start import');
        setState('error');
        return;
      }

      setJobId(data.jobId);
      schedulePoll(data.jobId);
    } catch {
      setError('Network error while starting import');
      setState('error');
    }
  }, [scanResult, driveUrl, eventId, importMode, useNewAlbum, newAlbumName, selectedAlbumId, schedulePoll]);

  // ── Cancel import ──────────────────────────────────────────

  const handleCancel = useCallback(async () => {
    if (!jobId) return;

    try {
      await fetch('/api/import/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
    } catch {
      // Best effort
    }
  }, [jobId]);

  // ── Reset ──────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setState('input');
    setDriveUrl('');
    setScanResult(null);
    setImportMode('flat');
    setSelectedAlbumId('');
    setNewAlbumName('');
    setUseNewAlbum(true);
    setJobId(null);
    setProgress(null);
    setError(null);
    pollCountRef.current = 0;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Render states ──────────────────────────────────────────

  // Input state
  if (state === 'input') {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <DriveIcon />
            <h3 className="text-lg font-semibold text-gray-900">Import from Google Drive</h3>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Paste a Google Drive folder link to import all photos. The folder must be shared as
            &quot;Anyone with the link&quot;.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            />
            <button
              onClick={handleScan}
              disabled={!driveUrl.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Scanning state
  if (state === 'scanning') {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-center">
          <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-600">Scanning folder and subfolders...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a moment for large folders</p>
        </div>
      </div>
    );
  }

  // Preview state
  if (state === 'preview' && scanResult) {
    const hasFolders = scanResult.folders.length > 0;

    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          {/* Summary */}
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {scanResult.folderName}
            </h3>
            <p className="text-sm text-gray-600">
              Found <span className="font-medium text-gray-900">{scanResult.totalImages.toLocaleString()}</span> photos
              {hasFolders && (
                <> across <span className="font-medium text-gray-900">{scanResult.folders.length}</span> subfolder{scanResult.folders.length !== 1 ? 's' : ''}</>
              )}
              {scanResult.rootFileCount > 0 && hasFolders && (
                <> ({scanResult.rootFileCount} in root)</>
              )}
            </p>
            {scanResult.truncated && (
              <p className="text-xs text-amber-600 mt-1">
                This folder has more than 10,000 photos. Only the first 10,000 will be imported.
              </p>
            )}
            {scanResult.totalSkipped > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {scanResult.totalSkipped} non-image file{scanResult.totalSkipped !== 1 ? 's' : ''} will be skipped
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Estimated size: {formatBytes(scanResult.estimatedSize)}
            </p>
          </div>

          {/* Subfolder list (if any) */}
          {hasFolders && (
            <div className="mb-5 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Subfolders</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {scanResult.folders.map((f) => (
                  <div key={f.path} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate">{f.name}</span>
                    <span className="text-gray-400 ml-2 flex-shrink-0">{f.fileCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import mode selection */}
          <div className="mb-5 space-y-3">
            <p className="text-sm font-medium text-gray-700">Import mode</p>

            {/* Flat mode */}
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="importMode"
                value="flat"
                checked={importMode === 'flat'}
                onChange={() => setImportMode('flat')}
                className="mt-0.5 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">All photos into one album</p>
                <p className="text-xs text-gray-500">Merge all subfolders into a single album</p>
              </div>
            </label>

            {/* Folder-to-album mode */}
            {hasFolders && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input
                  type="radio"
                  name="importMode"
                  value="folder_to_album"
                  checked={importMode === 'folder_to_album'}
                  onChange={() => setImportMode('folder_to_album')}
                  className="mt-0.5 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Keep folder structure</p>
                  <p className="text-xs text-gray-500">
                    Create albums from subfolder names:
                    {' '}
                    {scanResult.folders.slice(0, 3).map((f) => `"${f.name}"`).join(', ')}
                    {scanResult.folders.length > 3 && `, +${scanResult.folders.length - 3} more`}
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Album picker (flat mode only) */}
          {importMode === 'flat' && (
            <div className="mb-5 space-y-3">
              <p className="text-sm font-medium text-gray-700">Target album</p>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="albumTarget"
                  checked={useNewAlbum}
                  onChange={() => setUseNewAlbum(true)}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-700">Create new album</span>
              </label>

              {useNewAlbum && (
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="Album name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ml-6"
                />
              )}

              {albums.length > 0 && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="albumTarget"
                      checked={!useNewAlbum}
                      onChange={() => setUseNewAlbum(false)}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">Existing album</span>
                  </label>

                  {!useNewAlbum && (
                    <select
                      value={selectedAlbumId}
                      onChange={(e) => setSelectedAlbumId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ml-6"
                    >
                      <option value="">Select an album...</option>
                      {albums.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleStartImport}
              disabled={
                scanResult.totalImages === 0 ||
                (importMode === 'flat' && !useNewAlbum && !selectedAlbumId)
              }
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start Import ({scanResult.totalImages.toLocaleString()} photos)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Importing state
  if (state === 'importing') {
    const total = progress?.total_files || scanResult?.totalImages || 0;
    const done = progress?.completed || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const statusText = progress?.status === 'listing'
      ? 'Scanning folder...'
      : `Importing photos... ${done.toLocaleString()}/${total.toLocaleString()}`;

    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{statusText}</h3>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-3 mb-3 overflow-hidden">
            <div
              className="bg-brand-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 mb-4">
            <span>{pct}% complete</span>
            <div className="flex gap-3">
              {progress && progress.skipped > 0 && (
                <span className="text-gray-400">{progress.skipped} skipped</span>
              )}
              {progress && progress.failed > 0 && (
                <span className="text-amber-600">{progress.failed} failed</span>
              )}
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="w-full px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Cancel Import
          </button>
        </div>
      </div>
    );
  }

  // Complete state
  if (state === 'complete' && progress) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-white border border-green-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckIcon />
            <h3 className="text-lg font-semibold text-green-800">Import Complete!</h3>
          </div>

          <div className="space-y-1 text-sm text-gray-600 mb-5">
            <p>
              <span className="font-medium text-gray-900">{progress.completed.toLocaleString()}</span> photos imported
            </p>
            {progress.failed > 0 && (
              <p>
                <span className="font-medium text-amber-600">{progress.failed}</span> failed
              </p>
            )}
            {progress.skipped > 0 && (
              <p>
                <span className="font-medium text-gray-500">{progress.skipped}</span> skipped (duplicates, oversized, or unsupported)
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Import More
            </button>
            {onImportComplete && (
              <button
                onClick={onImportComplete}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
              >
                View Photos
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Cancelled state (separate from error)
  if (state === 'cancelled') {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-white border border-amber-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CancelIcon />
            <h3 className="text-lg font-semibold text-amber-800">Import Cancelled</h3>
          </div>

          <div className="space-y-1 text-sm text-gray-600 mb-5">
            {progress && (
              <>
                <p>
                  <span className="font-medium text-gray-900">{progress.completed.toLocaleString()}</span> photos were imported before cancellation
                </p>
                {progress.failed > 0 && (
                  <p>
                    <span className="font-medium text-amber-600">{progress.failed}</span> failed
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Start Over
            </button>
            {onImportComplete && progress && progress.completed > 0 && (
              <button
                onClick={onImportComplete}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors"
              >
                View Photos
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Import Failed</h3>
          <p className="text-sm text-red-600 mb-4">{error || 'An unknown error occurred'}</p>

          {progress && progress.completed > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              {progress.completed} photos were imported before the error.
            </p>
          )}

          <button
            onClick={handleReset}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Icons ────────────────────────────────────────────────────

function DriveIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <path d="M7.71 3.5L1.15 15L4.58 21L11.13 9.5L7.71 3.5Z" fill="#0066DA" />
      <path d="M16.29 3.5H7.71L14.27 15.5H22.85L16.29 3.5Z" fill="#00AC47" />
      <path d="M1.15 15L4.58 21H19.42L22.85 15H14.27H1.15Z" fill="#FFBA00" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
      <circle cx="10" cy="10" r="10" fill="#16A34A" />
      <path d="M6 10L9 13L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
      <circle cx="10" cy="10" r="10" fill="#D97706" />
      <path d="M7 7L13 13M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
