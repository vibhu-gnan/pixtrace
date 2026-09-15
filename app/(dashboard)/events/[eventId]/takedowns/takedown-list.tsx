'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveTakedown, declineTakedown, type TakedownRequestRow } from '@/actions/takedowns';

function hoursLeft(isoDeadline: string): string {
  const ms = new Date(isoDeadline).getTime() - Date.now();
  if (ms <= 0) return 'back in the gallery';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export default function TakedownList({
  eventId,
  requests,
}: {
  eventId: string;
  requests: TakedownRequestRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);

  const act = (id: string, action: 'approve' | 'decline') => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result =
        action === 'approve' ? await approveTakedown(id) : await declineTakedown(id);
      setBusyId(null);
      setConfirmingId(null);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-10 text-center">
        <p className="text-sm text-gray-500">No requests waiting. Nothing to do.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {requests.map((request) => {
        const isBusy = pending && busyId === request.id;
        const confirming = confirmingId === request.id;

        return (
          <div key={request.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4 min-w-0">
                {/* Approving deletes the photo, so show it rather than asking blind. */}
                {request.preview_url ? (
                  <button
                    type="button"
                    onClick={() => setZoomedId(zoomedId === request.id ? null : request.id)}
                    className="shrink-0 rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 transition-colors"
                    title="Click to enlarge"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={request.preview_url}
                      alt={request.filename || 'Photo requested for removal'}
                      className="w-20 h-20 object-cover"
                    />
                  </button>
                ) : (
                  <div className="shrink-0 w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <span className="text-[10px] text-gray-400 text-center px-1">preview<br />unavailable</span>
                  </div>
                )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {request.requester_email || 'A signed-in guest'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Hidden now · {hoursLeft(request.auto_restore_at)} before it returns
                </p>
                {request.filename && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{request.filename}</p>
                )}
                {request.reason && (
                  <p className="mt-2 text-sm text-gray-700 bg-gray-50 border-l-2 border-gray-300 pl-3 py-1.5">
                    {request.reason}
                  </p>
                )}
              </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => act(request.id, 'decline')}
                  disabled={isBusy}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
                >
                  Keep photo
                </button>
                {confirming ? (
                  <button
                    onClick={() => act(request.id, 'approve')}
                    disabled={isBusy}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                  >
                    {isBusy ? 'Removing…' : 'Yes, remove it'}
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmingId(request.id)}
                    disabled={isBusy}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {zoomedId === request.id && request.preview_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={request.preview_url}
                alt={request.filename || 'Photo requested for removal'}
                className="mt-3 w-full max-h-[60vh] object-contain rounded-lg bg-gray-50 border border-gray-200"
              />
            )}

            {confirming && (
              <p className="mt-3 text-xs text-gray-500">
                The photo stays hidden and is permanently deleted after 30 days. Until then this
                can still be undone.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
