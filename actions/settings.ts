'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import type { NotificationPreferences, DefaultEventPreferences } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/auth';
import {
  sanitizePhone,
  sanitizeText,
  sanitizeBrandingKey,
  sanitizeWhatsApp,
  sanitizeInstagram,
  sanitizeWebsite,
  sanitizePublicEmail,
} from '@/lib/validation/contact';

// ─── Helpers ─────────────────────────────────────────────────

/** Strip a JSONB payload down to only the known keys, preventing injection of extra fields. */
function pickBooleans(
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
): { valid: true; data: Record<string, boolean> } | { valid: false; badKey: string } {
  const out: Record<string, boolean> = {};
  for (const key of allowedKeys) {
    if (typeof input[key] !== 'boolean') {
      return { valid: false, badKey: key };
    }
    out[key] = input[key] as boolean;
  }
  return { valid: true, data: out };
}

/**
 * Validate avatar URL — must be either:
 *  - An R2 key (starts with "avatars/" — relative path, no protocol)
 *  - A Google avatar URL (https://lh3.googleusercontent.com/...)
 *  - null (no avatar)
 * Rejects anything else to prevent stored XSS via avatar_url.
 */
function sanitizeAvatarUrl(url: string | null): string | null {
  if (!url) return null;
  // R2 key — relative path, no slashes or protocol at start
  if (/^avatars\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.\w{2,5}$/.test(url)) return url;
  // Google avatar URL
  if (url.startsWith('https://lh3.googleusercontent.com/')) return url;
  // Gravatar
  if (url.startsWith('https://www.gravatar.com/') || url.startsWith('https://gravatar.com/')) return url;
  // Reject everything else
  return null;
}

// sanitizePhone and the photographer-credit validators live in
// lib/validation/contact.ts — they are shared with the branding form and cannot
// be exported from here, since every export of a 'use server' module becomes a
// public POST endpoint and Next.js rejects non-async exports outright.

// ─── Profile ─────────────────────────────────────────────────

export async function updateProfile(data: {
  name: string;
  phone: string | null;
  businessName: string | null;
  avatarUrl: string | null;
}) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  // Guard: server actions receive untrusted input — verify types
  if (!data || typeof data.name !== 'string') {
    return { error: 'Invalid input' };
  }

  // Validate name
  const name = data.name.trim();
  if (!name || name.length > 255) {
    return { error: 'Name is required and must be under 255 characters' };
  }

  // Sanitize phone
  const phone = sanitizePhone(data.phone);

  // Validate business name
  const businessName = data.businessName?.trim() || null;
  if (businessName && businessName.length > 255) {
    return { error: 'Business name must be under 255 characters' };
  }

  // Sanitize avatar URL to prevent XSS
  const avatarUrl = sanitizeAvatarUrl(data.avatarUrl);

  // Clean up old R2 avatar if replacing with a different one
  const oldAvatar = organizer.avatar_url;
  const isOldR2Key = oldAvatar && oldAvatar.startsWith('avatars/');
  const isNewDifferentR2Key = avatarUrl && avatarUrl.startsWith('avatars/') && avatarUrl !== oldAvatar;
  if (isOldR2Key && (isNewDifferentR2Key || !avatarUrl?.startsWith('avatars/'))) {
    // Fire-and-forget: delete old avatar from R2
    import('@/lib/storage/r2-cleanup')
      .then(({ deleteR2WithTracking }) => {
        deleteR2WithTracking([oldAvatar], 'media_delete');
      })
      .catch((err) => console.error('Failed to clean up old avatar:', err));
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('organizers')
    .update({
      name,
      phone,
      business_name: businessName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizer.id);

  if (error) {
    console.error('Failed to update profile:', error);
    return { error: 'Failed to update profile' };
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
}

// ─── Photographer Credit ─────────────────────────────────────

export interface CreditProfileInput {
  enabled: boolean;
  displayName: string | null;
  tagline: string | null;
  logoKey: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  publicEmail: string | null;
}

/** Channels that count as "reachable" — enabling the credit needs at least one. */
function countChannels(row: {
  credit_whatsapp: string | null;
  credit_instagram: string | null;
  credit_website: string | null;
  credit_public_email: string | null;
}): number {
  return [row.credit_whatsapp, row.credit_instagram, row.credit_website, row.credit_public_email]
    .filter(Boolean).length;
}

/**
 * Save the photographer's public credit.
 *
 * Each field is dropped to null rather than rejected when it doesn't validate,
 * so one malformed handle never blocks the whole save — with one exception:
 * turning the credit ON is refused unless there is a name and a way to be
 * reached, because a credit with no contact is just clutter on the gallery.
 *
 * Note what is NOT done here: enabling on the caller's behalf. Publishing a
 * phone number and email to every gallery guest is an explicit act, never
 * inferred from the fields being filled in.
 */
export async function updateCreditProfile(data: CreditProfileInput) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };
  if (!data || typeof data !== 'object') return { error: 'Invalid input' };

  const displayName = sanitizeText(data.displayName, 80);
  const tagline = sanitizeText(data.tagline, 120);
  const logoKey = sanitizeBrandingKey(data.logoKey);
  const whatsapp = sanitizeWhatsApp(data.whatsapp);
  const instagram = sanitizeInstagram(data.instagram);
  const website = sanitizeWebsite(data.website);
  const publicEmail = sanitizePublicEmail(data.publicEmail);

  const next = {
    credit_whatsapp: whatsapp,
    credit_instagram: instagram,
    credit_website: website,
    credit_public_email: publicEmail,
  };

  const enabled = data.enabled === true;
  if (enabled && !displayName) {
    return { error: 'Add a studio or display name before showing your details.' };
  }
  if (enabled && countChannels(next) === 0) {
    return { error: 'Add at least one way to reach you before showing your details.' };
  }

  // Clean up a replaced logo. Same fire-and-forget idiom as updateProfile —
  // a failed delete must not fail the save; r2-cleanup tracks it for retry.
  const oldLogo = organizer.credit_logo_url;
  if (oldLogo?.startsWith('branding/') && oldLogo !== logoKey) {
    import('@/lib/storage/r2-cleanup')
      .then(({ deleteR2WithTracking }) => {
        deleteR2WithTracking([oldLogo], 'media_delete');
      })
      .catch((err) => console.error('Failed to clean up old branding logo:', err));
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('organizers')
    .update({
      credit_enabled: enabled,
      credit_display_name: displayName,
      credit_tagline: tagline,
      credit_logo_url: logoKey,
      ...next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizer.id);

  if (error) {
    console.error('Failed to update credit profile:', error);
    return { error: 'Failed to save your details' };
  }

  revalidatePath('/settings');

  // Galleries are ISR'd at an hour, so without this a change is invisible for
  // up to that long. Bounded to the 50 most recent events: an organizer with
  // hundreds should not pay for a full sweep on every keystroke-to-save, and
  // the stale remainder self-corrects on its next revalidation anyway.
  try {
    const { data: events } = await supabase
      .from('events')
      .select('event_hash')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false })
      .limit(50);

    for (const e of (events ?? []) as Array<{ event_hash: string | null }>) {
      if (!e.event_hash) continue;
      revalidatePath(`/gallery/${e.event_hash}`);
      revalidatePath(`/${e.event_hash}`);
    }
  } catch (err) {
    console.error('Credit profile saved but gallery revalidation failed:', err);
  }

  return { success: true };
}

// ─── Notification Preferences ────────────────────────────────

const NOTIFICATION_KEYS = [
  'email_new_gallery_view',
  'email_photo_upload_activity',
  'email_storage_warnings',
  'email_billing_alerts',
  'email_product_updates',
  'email_tips_and_tutorials',
] as const;

export async function updateNotificationPreferences(prefs: NotificationPreferences) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  // Strip to known keys only — prevents injecting extra fields into JSONB
  const result = pickBooleans(prefs as unknown as Record<string, unknown>, NOTIFICATION_KEYS);
  if (!result.valid) {
    return { error: `Invalid value for ${result.badKey}` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('organizers')
    .update({
      notification_preferences: result.data as unknown as NotificationPreferences,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizer.id);

  if (error) {
    console.error('Failed to update notification preferences:', error);
    return { error: 'Failed to update preferences' };
  }

  revalidatePath('/settings');
  return { success: true };
}

// ─── Default Event Preferences ───────────────────────────────

const EVENT_PREF_KEYS = [
  'watermark_enabled',
  'downloads_enabled',
  'auto_approve_photos',
] as const;

export async function updateDefaultEventPreferences(prefs: DefaultEventPreferences) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const result = pickBooleans(prefs as unknown as Record<string, unknown>, EVENT_PREF_KEYS);
  if (!result.valid) {
    return { error: `Invalid value for ${result.badKey}` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('organizers')
    .update({
      default_event_preferences: result.data as unknown as DefaultEventPreferences,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizer.id);

  if (error) {
    console.error('Failed to update default event preferences:', error);
    return { error: 'Failed to update preferences' };
  }

  revalidatePath('/settings');
  return { success: true };
}

// ─── Password Change ─────────────────────────────────────────

export async function changePassword(data: {
  newPassword: string;
  confirmPassword: string;
}) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  if (!data || typeof data.newPassword !== 'string' || typeof data.confirmPassword !== 'string') {
    return { error: 'Invalid input' };
  }

  if (!data.newPassword || data.newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  if (data.newPassword.length > 128) {
    return { error: 'Password is too long' };
  }

  if (data.newPassword !== data.confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  // Use the user's own session client (not admin) so Supabase validates the session
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: data.newPassword,
  });

  if (error) {
    console.error('Failed to change password:', error);
    return { error: error.message || 'Failed to change password' };
  }

  return { success: true };
}

// ─── Export Data ──────────────────────────────────────────────

const EXPORT_MEDIA_LIMIT = 10_000; // safety cap

export async function exportAccountData() {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  // Step 1: fetch events first (needed for media sub-query)
  const { data: events } = await supabase
    .from('events')
    .select('id, name, description, event_date, event_hash, is_public, created_at, view_count')
    .eq('organizer_id', organizer.id)
    .order('created_at', { ascending: false });

  const eventIds = (events || []).map((e) => e.id);

  // Step 2: fetch media + payments in parallel (both independent after having eventIds)
  const [mediaRes, paymentsRes] = await Promise.all([
    eventIds.length > 0
      ? supabase
          .from('media')
          .select('id, original_filename, media_type, file_size, captured_at, uploaded_at, event_id')
          .in('event_id', eventIds)
          .limit(EXPORT_MEDIA_LIMIT)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase
      .from('payment_history')
      .select('id, amount, currency, status, payment_method, created_at')
      .eq('organizer_id', organizer.id)
      .order('created_at', { ascending: false }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: {
      name: organizer.name,
      email: organizer.email,
      phone: organizer.phone,
      business_name: organizer.business_name,
      plan_id: organizer.plan_id,
      created_at: organizer.created_at,
    },
    events: events || [],
    media_count: (mediaRes as { data?: unknown[] }).data?.length ?? 0,
    media: (mediaRes as { data?: unknown[] }).data || [],
    payments: paymentsRes.data || [],
  };

  return { success: true, data: exportData };
}

// ─── Delete Account ──────────────────────────────────────────

export async function deleteAccount(confirmEmail: string) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  if (typeof confirmEmail !== 'string') {
    return { error: 'Invalid input' };
  }

  // Verify confirmation (case-insensitive)
  if (confirmEmail.toLowerCase().trim() !== organizer.email.toLowerCase()) {
    return { error: 'Email does not match. Please type your email to confirm.' };
  }

  // Prevent admin self-deletion
  if (organizer.is_admin) {
    return { error: 'Admin accounts cannot be deleted through settings. Contact support.' };
  }

  const supabase = createAdminClient();

  // Cancel active Razorpay subscription if any
  try {
    const { data: activeSub } = await supabase
      .from('subscriptions')
      .select('razorpay_subscription_id')
      .eq('organizer_id', organizer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (activeSub?.razorpay_subscription_id) {
      const { getRazorpayClient } = await import('@/lib/razorpay/client');
      const razorpay = getRazorpayClient();
      await razorpay.subscriptions.cancel(activeSub.razorpay_subscription_id, true);
    }
  } catch (err) {
    console.error('Failed to cancel subscription during account deletion:', err);
    // Continue — subscription will expire naturally, don't block deletion
  }

  // Collect all R2 keys to delete (media + logos + avatars)
  try {
    const { deleteR2WithTracking } = await import('@/lib/storage/r2-cleanup');

    const { data: events } = await supabase
      .from('events')
      .select('id, theme')
      .eq('organizer_id', organizer.id);

    const allKeysToDelete: string[] = [];

    if (events && events.length > 0) {
      const eventIds = events.map((e) => e.id);

      // Media files (paginated to handle large accounts)
      let offset = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const { data: mediaPage } = await supabase
          .from('media')
          .select('r2_key, thumbnail_r2_key, preview_r2_key')
          .in('event_id', eventIds)
          .range(offset, offset + PAGE_SIZE - 1);

        if (!mediaPage || mediaPage.length === 0) break;

        for (const m of mediaPage) {
          if (m.r2_key) allKeysToDelete.push(m.r2_key);
          if (m.thumbnail_r2_key) allKeysToDelete.push(m.thumbnail_r2_key);
          if (m.preview_r2_key) allKeysToDelete.push(m.preview_r2_key);
        }

        if (mediaPage.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      // Logo files from event themes
      for (const event of events) {
        const logoUrl = (event.theme as Record<string, unknown>)?.logoUrl;
        if (typeof logoUrl === 'string' && logoUrl.startsWith('logos/')) {
          allKeysToDelete.push(logoUrl);
        }
      }
    }

    // Avatar file
    if (organizer.avatar_url && organizer.avatar_url.startsWith('avatars/')) {
      allKeysToDelete.push(organizer.avatar_url);
    }

    // Photographer-credit logo. Organizer-scoped, so it is not covered by the
    // per-event `logos/` loop above and would otherwise be orphaned forever.
    if (organizer.credit_logo_url && organizer.credit_logo_url.startsWith('branding/')) {
      allKeysToDelete.push(organizer.credit_logo_url);
    }

    // Delete all R2 objects in batches
    for (let i = 0; i < allKeysToDelete.length; i += 100) {
      const batch = allKeysToDelete.slice(i, i + 100);
      deleteR2WithTracking(batch, 'media_delete');
    }
  } catch (err) {
    console.error('R2 cleanup error during account deletion:', err);
    // Continue with DB deletion even if R2 cleanup partially fails
  }

  // Delete organizer (cascades to events → albums → media via FK)
  const { error: deleteError } = await supabase
    .from('organizers')
    .delete()
    .eq('id', organizer.id);

  if (deleteError) {
    console.error('Failed to delete organizer:', deleteError);
    return { error: 'Failed to delete account. Please try again or contact support.' };
  }

  // Delete auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(organizer.auth_id);
  if (authError) {
    console.error('Failed to delete auth user:', authError);
    // Organizer record already deleted, auth user orphaned but not critical
  }

  return { success: true };
}
