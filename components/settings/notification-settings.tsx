'use client';

import { useState } from 'react';
import type { OrganizerProfile, NotificationPreferences } from '@/lib/auth/session';
import { updateNotificationPreferences } from '@/actions/settings';

interface NotificationSettingsProps {
  organizer: OrganizerProfile;
}

const NOTIFICATION_OPTIONS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  category: 'activity' | 'system' | 'marketing';
}[] = [
  {
    key: 'email_new_gallery_view',
    label: 'Gallery Views',
    description: 'Get notified when someone views your gallery',
    category: 'activity',
  },
  {
    key: 'email_photo_upload_activity',
    label: 'Photo Uploads',
    description: 'Get notified when photos are uploaded to your events',
    category: 'activity',
  },
  {
    key: 'email_storage_warnings',
    label: 'Storage Warnings',
    description: 'Get alerted when approaching your storage limit',
    category: 'system',
  },
  {
    key: 'email_billing_alerts',
    label: 'Billing Alerts',
    description: 'Payment confirmations, failures, and plan changes',
    category: 'system',
  },
  {
    key: 'email_product_updates',
    label: 'Product Updates',
    description: 'New features and improvements',
    category: 'marketing',
  },
  {
    key: 'email_tips_and_tutorials',
    label: 'Tips & Tutorials',
    description: 'Helpful tips to get the most out of PIXTRACE',
    category: 'marketing',
  },
];

export function NotificationSettings({ organizer }: NotificationSettingsProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    organizer.notification_preferences
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Track if any value differs from the saved state
  const hasChanges = NOTIFICATION_OPTIONS.some(
    (o) => prefs[o.key] !== organizer.notification_preferences[o.key]
  );

  function togglePref(key: keyof NotificationPreferences) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateNotificationPreferences(prefs);
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

  const categories = [
    { id: 'activity', label: 'Activity' },
    { id: 'system', label: 'System' },
    { id: 'marketing', label: 'Marketing' },
  ] as const;

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const options = NOTIFICATION_OPTIONS.filter((o) => o.category === cat.id);
        return (
          <div key={cat.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{cat.label}</h2>
            <div className="divide-y divide-gray-100">
              {options.map((option) => (
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
        );
      })}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Notification preferences saved!</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
