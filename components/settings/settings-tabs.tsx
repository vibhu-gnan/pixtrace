'use client';

import { useState, useCallback, useEffect } from 'react';
import type { OrganizerProfile } from '@/lib/auth/session';
import { ProfileForm } from './profile-form';
import { NotificationSettings } from './notification-settings';
import { EventDefaultsForm } from './event-defaults-form';
import { AccountSettings } from './account-settings';

export interface AuthInfo {
  hasGoogleProvider: boolean;
  hasEmailProvider: boolean;
  googleAvatarUrl: string | null;
  googleEmail: string | null;
}

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'event-defaults', label: 'Event Defaults' },
  { id: 'account', label: 'Account' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

function getInitialTab(): TabId {
  if (typeof window === 'undefined') return 'profile';
  const hash = window.location.hash.slice(1);
  return TAB_IDS.has(hash) ? (hash as TabId) : 'profile';
}

interface SettingsTabsProps {
  organizer: OrganizerProfile;
  authInfo: AuthInfo;
}

export function SettingsTabs({ organizer, authInfo }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // Sync tab from URL hash on mount
  useEffect(() => {
    setActiveTab(getInitialTab());
  }, []);

  const switchTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  }, []);

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Settings tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`whitespace-nowrap pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && (
        <ProfileForm organizer={organizer} authInfo={authInfo} />
      )}
      {activeTab === 'notifications' && (
        <NotificationSettings organizer={organizer} />
      )}
      {activeTab === 'event-defaults' && (
        <EventDefaultsForm organizer={organizer} />
      )}
      {activeTab === 'account' && (
        <AccountSettings organizer={organizer} authInfo={authInfo} />
      )}
    </div>
  );
}
