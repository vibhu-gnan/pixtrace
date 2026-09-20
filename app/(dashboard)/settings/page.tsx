import { redirect } from 'next/navigation';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getUser } from '@/lib/auth';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { getSignedR2Url } from '@/lib/storage/r2-client';

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

  // The branding logo is stored as an R2 key, which the browser cannot fetch
  // directly — /api/proxy-image only authorizes media and cover keys, not
  // branding/. Sign it here instead. A failure must not take down Settings, so
  // the form falls back to the empty-logo state.
  let creditLogoUrl: string | null = null;
  if (organizer.credit_logo_url?.startsWith('branding/')) {
    try {
      creditLogoUrl = await getSignedR2Url(organizer.credit_logo_url);
    } catch (err) {
      console.error('Failed to sign branding logo URL:', err);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <SettingsTabs
        organizer={organizer}
        creditLogoUrl={creditLogoUrl}
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
