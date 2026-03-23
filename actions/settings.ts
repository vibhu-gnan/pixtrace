'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import type { NotificationPreferences, DefaultEventPreferences } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/auth';

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

/** Strip phone to digits, +, spaces, and hyphens only. */
function sanitizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^\d+\-\s()]/g, '');
  if (!cleaned || cleaned.length > 20) return null;
  return cleaned;
}

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
