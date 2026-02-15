import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OrganizerProfile {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Resolve the current user from the Supabase session cookie using the
 * admin client instead of the SSR anon client.
 *
 * Why: the SSR createServerClient() + auth.getUser() path internally runs
 * Supabase schema introspection queries (including pg_timezone_names) on
 * every call. The admin client calls the same Auth API endpoint but skips
 * that machinery entirely — autoRefreshToken and persistSession are both
 * false so no session state is maintained.
 *
 * The access token is read directly from the cookie and passed to
 * auth.getUser(token), which validates it server-side without any extra
 * DB round-trips.
 */
async function getUserFromCookie() {
  try {
    const cookieStore = await cookies();
    // Supabase stores the session as a JSON value in the sb-*-auth-token cookie.
    // The cookie name format is: sb-<project-ref>-auth-token
    const allCookies = cookieStore.getAll();
    const authCookie = allCookies.find(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );
    if (!authCookie?.value) return null;

    let token: string | null = null;
    try {
      // Cookie value is URL-encoded JSON: { access_token, refresh_token, ... }
      const decoded = decodeURIComponent(authCookie.value);
      const parsed = JSON.parse(decoded);
      token = parsed?.access_token ?? null;
    } catch {
      return null;
    }

    if (!token) return null;

    // Validate the JWT via Supabase Auth API using the admin client.
    // This is a single HTTPS call — no DB queries triggered.
    const supabase = createAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Get the current authenticated user and their organizer profile.
 * Creates organizer profile if it doesn't exist.
 * Uses Supabase admin client (service_role) to bypass RLS.
 */
export async function getCurrentOrganizer(): Promise<OrganizerProfile | null> {
  const user = await getUserFromCookie();

  if (!user) {
    return null;
  }

  const supabase = createAdminClient();

  // Check if organizer profile exists (maybeSingle returns null instead of error when no rows)
  const { data: organizer } = await supabase
    .from('organizers')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (organizer) {
    return organizer as OrganizerProfile;
  }

  // Create organizer profile if it doesn't exist
  const { data: newOrganizer, error } = await supabase
    .from('organizers')
    .upsert(
      {
        auth_id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
        avatar_url: user.user_metadata?.avatar_url || null,
      },
      { onConflict: 'auth_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error creating organizer profile:', error);
    return null;
  }

  return newOrganizer as OrganizerProfile;
}

/**
 * Verify if user is authenticated, throw if not.
 * Uses the same cookie-based approach as getCurrentOrganizer.
 */
export async function requireAuth() {
  const user = await getUserFromCookie();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
