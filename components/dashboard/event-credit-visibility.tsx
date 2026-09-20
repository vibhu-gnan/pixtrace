'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateEventCreditVisibility } from '@/actions/events';

/**
 * Per-event override for the photographer credit.
 *
 * Phrased from the client's side rather than the system's — the real case is
 * "this client asked for an unbranded gallery", not "disable a feature". It is
 * an override only: name and channels stay organizer-level, in Settings.
 *
 * Optimistic with revert-on-error, matching the logoDisplay radio group in
 * event-logo-settings.tsx — but with that component's mistakes left behind: the
 * server's error message is shown rather than discarded into an alert().
 */
export function EventCreditVisibility({
  eventId,
  initialHidden,
}: {
  eventId: string;
  initialHidden: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(initialHidden);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    const previous = hidden;
    setHidden(next);          // optimistic
    setSaving(true);
    setError(null);

    try {
      const result = await updateEventCreditVisibility(eventId, next);
      if (result.error) {
        setHidden(previous);  // revert
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setHidden(previous);
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Your details on this gallery</h2>
      <p className="text-sm text-gray-500 mb-4">
        Your studio name and contact links appear at the bottom of every gallery.
        Turn them off here for a client who asked for an unbranded one.
      </p>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={hidden}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 disabled:opacity-40"
        />
        <span>
          <span className="block text-sm font-medium text-gray-900">
            Hide my studio details on this gallery
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Other galleries are unaffected. Changes appear within an hour.
          </span>
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-4 text-xs text-gray-500">
        Edit the details themselves in{' '}
        <Link href="/settings#branding" className="underline hover:text-gray-700">
          Settings → Branding
        </Link>
        .
      </p>
    </div>
  );
}
