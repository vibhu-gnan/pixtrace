import { getUser } from './index';
import { createAdminClient } from '@/lib/supabase/admin';

export interface NotificationPreferences {
  email_new_gallery_view: boolean;
  email_photo_upload_activity: boolean;
  email_storage_warnings: boolean;
  email_billing_alerts: boolean;
  email_product_updates: boolean;
  email_tips_and_tutorials: boolean;
}

export interface DefaultEventPreferences {
  watermark_enabled: boolean;
  downloads_enabled: boolean;
  auto_approve_photos: boolean;
}

export interface OrganizerProfile {
  id: string;
  auth_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  business_name: string | null;
  notification_preferences: NotificationPreferences;
  default_event_preferences: DefaultEventPreferences;
  plan_id: string;
  razorpay_customer_id: string | null;
  storage_used_bytes: number;
  is_admin: boolean;
  custom_storage_limit_bytes: number | null;
  custom_max_events: number | null;
  custom_feature_flags: Record<string, unknown> | null;
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

  // Fire-and-forget: send welcome email (don't block first page load)
  sendWelcomeEmail(newOrganizer as OrganizerProfile).catch((err) => {
    console.error('[WelcomeEmail] Failed:', err);
  });

  return newOrganizer as OrganizerProfile;
}

async function sendWelcomeEmail(organizer: OrganizerProfile): Promise<void> {
  const { sendEmail } = await import('@/lib/email/resend');
  const { welcomeSubject, welcomeHtml } = await import(
    '@/lib/email/templates/welcome'
  );

  const sent = await sendEmail({
    to: organizer.email,
    subject: welcomeSubject(),
    html: welcomeHtml({ name: organizer.name }),
    emailType: 'welcome',
  });

  if (sent) {
    console.log(`[WelcomeEmail] Sent to ${organizer.email}`);
  }
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
