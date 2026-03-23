'use client';

import { useState } from 'react';
import type { OrganizerProfile, DefaultEventPreferences } from '@/lib/auth/session';
import { updateDefaultEventPreferences } from '@/actions/settings';

interface EventDefaultsFormProps {
  organizer: OrganizerProfile;
}

const EVENT_DEFAULT_OPTIONS: {
  key: keyof DefaultEventPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: 'watermark_enabled',
    label: 'Watermark',
    description: 'Add a watermark to photos by default',
  },
  {
    key: 'downloads_enabled',
    label: 'Allow Downloads',
    description: 'Allow guests to download photos by default',
  },
  {
    key: 'auto_approve_photos',
    label: 'Auto-Approve Photos',
    description: 'Automatically approve uploaded photos without manual review',
  },
];

export function EventDefaultsForm({ organizer }: EventDefaultsFormProps) {
  const [prefs, setPrefs] = useState<DefaultEventPreferences>(
    organizer.default_event_preferences
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasChanges = EVENT_DEFAULT_OPTIONS.some(
    (o) => prefs[o.key] !== organizer.default_event_preferences[o.key]
  );

  function togglePref(key: keyof DefaultEventPreferences) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateDefaultEventPreferences(prefs);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Default Event Settings</h2>
        <p className="text-sm text-gray-500 mb-4">
          These defaults apply to newly created events. Existing events are not affected.
        </p>
        <div className="divide-y divide-gray-100">
          {EVENT_DEFAULT_OPTIONS.map((option) => (
            <div key={option.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{option.label}</p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[option.key]}
                onClick={() => togglePref(option.key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                  prefs[option.key] ? 'bg-brand-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    prefs[option.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Default event preferences saved!</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Defaults'}
        </button>
      </div>
    </div>
  );
}
