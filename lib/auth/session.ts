import { getUser } from './index';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OrganizerProfile {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  plan_id: string;
  razorpay_customer_id: string | null;
  storage_used_bytes: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current authenticated user and their organizer profile.
 * Creates organizer profile if it doesn't exist.
 * Uses Supabase admin client (service_role) to bypass RLS.
 */
export async function getCurrentOrganizer(): Promise<OrganizerProfile | null> {
  const user = await getUser();

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
  // user.email can be undefined for some OAuth providers (e.g., Apple "Hide My Email")
  const email = user.email || `${user.id}@noemail.pixtrace.in`;

  const { data: newOrganizer, error } = await supabase
    .from('organizers')
    .upsert(
      {
        auth_id: user.id,
        email,
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
 * Verify if user is authenticated, throw if not
 */
export async function requireAuth() {
  const user = await getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}
