'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateEventWatermark } from '@/actions/events';

/**
 * Per-event watermark control.
 *
 * Framed around the situation it is for — a gallery handed over before the
 * client has paid — rather than as a generic image option, because that is the
 * only time a photographer wants their own name across their own work.
 */
export function EventWatermarkSettings({
  eventId,
  initialEnabled,
  initialText,
  studioName,
}: {
  eventId: string;
  initialEnabled: boolean;
  initialText: string | null;
  /** What gets burned in when no override is set. */
  studioName: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [text, setText] = useState(initialText || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const effective = text.trim() || studioName;
  const dirty = enabled !== initialEnabled || text.trim() !== (initialText || '');

  async function save(nextEnabled: boolean, nextText: string) {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await updateEventWatermark(eventId, nextEnabled, nextText);
      if (result.error) {
        setError(result.error);
        setEnabled(initialEnabled);   // revert the optimistic flip
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setEnabled(initialEnabled);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Watermark</h2>
      <p className="text-sm text-gray-500 mb-4">
        Puts your studio name across every photo in this gallery. For sharing a
        gallery before the client has paid — they can review the work, but not use it.
      </p>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => {
            setEnabled(e.target.checked);
            void save(e.target.checked, text);
          }}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 disabled:opacity-40"
        />
        <span>
          <span className="block text-sm font-medium text-gray-900">
            Watermark every photo in this gallery
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            Applies to the gallery, the full-screen view and downloads.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4 pl-7">
          <label htmlFor="wm-text" className="block text-sm font-medium text-gray-700 mb-1">
            Wording <span className="font-normal text-gray-400">· optional</span>
          </label>
          <div className="flex gap-2">
            <input
              id="wm-text"
              type="text"
              value={text}
              maxLength={60}
              placeholder={studioName}
              onChange={(e) => setText(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => void save(enabled, text)}
              disabled={saving || !dirty}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Photos will read <span className="font-medium text-gray-700">{effective}</span>. Leave blank to use your studio name.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-green-600">Saved. Photos update within a few minutes.</p>}
    </div>
  );
}
