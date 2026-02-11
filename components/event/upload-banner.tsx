'use client';

import * as Progress from '@radix-ui/react-progress';
import { useUploadStore } from '@/lib/upload/upload-manager';

interface UploadBannerProps {
  eventName: string;
}

export function UploadBanner({ eventName }: UploadBannerProps) {
  const { items, isUploading, clearAll, uploadStartedAt } = useUploadStore();

  if (items.length === 0) return null;

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  // Calculate overall progress
  const totalProgress = items.reduce((sum, item) => sum + item.progress, 0);
  const overallProgress = totalCount > 0 ? Math.round(totalProgress / totalCount) : 0;

  // Calculate real speed based on actual bytes uploaded and elapsed time
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const uploadedBytes = items.reduce((sum, item) => sum + (item.file.size * item.progress / 100), 0);
  const elapsedSeconds = uploadStartedAt ? (Date.now() - uploadStartedAt) / 1000 : 0;
  const bytesPerSecond = elapsedSeconds > 0.5 ? uploadedBytes / elapsedSeconds : 0;
  const speedMBps = isUploading && bytesPerSecond > 0
    ? (bytesPerSecond / (1024 * 1024)).toFixed(1)
    : '0';

  // Estimate time remaining based on real speed
  const remainingBytes = totalBytes - uploadedBytes;
  let estimatedTimeStr: string | null = null;
  if (isUploading && bytesPerSecond > 0 && overallProgress > 2) {
    const remainingSeconds = remainingBytes / bytesPerSecond;
    if (remainingSeconds < 60) {
      estimatedTimeStr = `~${Math.max(1, Math.ceil(remainingSeconds))} sec${Math.ceil(remainingSeconds) > 1 ? 's' : ''}`;
    } else {
      const mins = Math.ceil(remainingSeconds / 60);
      estimatedTimeStr = `~${mins} min${mins > 1 ? 's' : ''}`;
    }
  }

  // All done state
  const allDone = !isUploading && doneCount === totalCount && totalCount > 0;
  const hasErrors = errorCount > 0;

  if (allDone && !hasErrors) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800">
              All {doneCount} photos uploaded successfully!
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              Refresh to see them in the gallery below
            </p>
          </div>
          <button
            onClick={clearAll}
            className="text-xs text-green-700 hover:text-green-900 font-medium px-3 py-1.5 rounded-lg border border-green-300 hover:bg-green-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Current Batch: {eventName}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {isUploading
              ? `Uploading and indexing ${totalCount} photos`
              : hasErrors
                ? `${doneCount} uploaded, ${errorCount} failed`
                : `${totalCount} photos queued`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isUploading && (
            <button
              className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
              disabled
              title="Pause not yet supported"
            >
              Pause
            </button>
          )}
          <button
            onClick={clearAll}
            className="px-4 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-full hover:bg-red-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Progress section */}
      {(isUploading || (!allDone && doneCount > 0)) && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-brand-600">
              {isUploading ? 'Uploading...' : 'Processing...'}
            </span>
            <span className="text-sm text-gray-500">
              {overallProgress}% ({doneCount}/{totalCount})
            </span>
          </div>

          <Progress.Root
            className="relative overflow-hidden bg-gray-100 rounded-full w-full h-2.5"
            value={overallProgress}
          >
            <Progress.Indicator
              className="bg-brand-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </Progress.Root>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-400">
              {estimatedTimeStr
                ? `Time remaining: ${estimatedTimeStr}`
                : 'Estimating time...'
              }
            </span>
            <span className="text-xs text-gray-400">
              Speed: {speedMBps} MB/s
            </span>
          </div>
        </div>
      )}

      {/* Error summary */}
      {hasErrors && !isUploading && (
        <div className="mt-3 text-xs text-red-600">
          {errorCount} file{errorCount > 1 ? 's' : ''} failed to upload. Try again or clear the queue.
        </div>
      )}

      {/* Debug info (only shown in development) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
            Debug Info
          </summary>
          <div className="mt-2 space-y-1 font-mono text-gray-600 bg-gray-50 p-2 rounded">
            {items.slice(0, 3).map(item => (
              <div key={item.id} className="text-[10px]">
                {item.file.name.slice(0, 30)}: {item.status} - {item.progress}%
                {item.error && ` (${item.error})`}
              </div>
            ))}
            {items.length > 3 && (
              <div className="text-gray-400 text-[10px]">
                ...and {items.length - 3} more files
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
