import { redirect } from 'next/navigation';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getUser } from '@/lib/auth';
import { SettingsTabs } from '@/components/settings/settings-tabs';

export default async function SettingsPage() {
  // Fetch both in parallel — getCurrentOrganizer() and getUser() each call
  // supabase.auth.getUser() internally, but Next.js deduplicates fetch requests
  // within a single render pass, so there's no double auth call to Supabase.
  const [organizer, user] = await Promise.all([
    getCurrentOrganizer(),
    getUser(),
  ]);

  if (!organizer || !user) redirect('/sign-in');

  // Determine auth provider info
  const identities = user.identities || [];
  const hasGoogleProvider = identities.some((i) => i.provider === 'google');
  const hasEmailProvider = identities.some((i) => i.provider === 'email');
  const googleAvatarUrl = user.user_metadata?.avatar_url || null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <SettingsTabs
        organizer={organizer}
        authInfo={{
          hasGoogleProvider,
          hasEmailProvider,
          googleAvatarUrl,
          googleEmail: identities.find((i) => i.provider === 'google')?.identity_data?.email || null,
        }}
      />
    </div>
  );
}
