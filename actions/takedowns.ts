'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteR2WithTracking } from '@/lib/storage/r2-cleanup';
import { decrementStorageUsed } from '@/lib/plans/limits';
import { sendTakedownRequestEmail } from '@/lib/email/send-takedown-email';

/** How long a photo stays hidden while the organizer decides. */
const HIDE_WINDOW_HOURS = 6;
/** Grace period after approval, during which a mistaken approval is recoverable. */
const PURGE_AFTER_DAYS = 30;

// Requests come from signed-in visitors, so limits are enforced with queries rather
// than the in-memory limiter used elsewhere — that one is per-lambda on serverless and
// cannot bound anything globally.
const MAX_PENDING_PER_REQUESTER = 3;
const MAX_PENDING_PER_EVENT = 10;

export interface TakedownRequestRow {
  id: string;
  media_id: string;
  requester_email: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  auto_restore_at: string;
}

/**
 * A guest asks for a photo to come down. Hides it immediately and notifies the
 * organizer; if nobody acts, it reappears on its own once `auto_restore_at` passes.
 */
export async function requestTakedown(input: {
  eventHash: string;
  mediaId: string;
  reason?: string;
  accessToken: string;
}): Promise<{ success?: boolean; error?: string }> {
  const { eventHash, mediaId, reason, accessToken } = input;
  if (!eventHash || !mediaId || !accessToken) return { error: 'Missing information' };

  const supabase = createAdminClient();

  const { data: auth } = await supabase.auth.getUser(accessToken);
  const user = auth?.user;
  if (!user) return { error: 'Please sign in to request a removal' };

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_hash')
    .eq('event_hash', eventHash)
    .eq('is_public', true)
    .single();

  if (!event) return { error: 'Gallery not found' };

  // The photo must belong to this gallery — never trust a media id from the client.
  const { data: media } = await supabase
    .from('media')
    .select('id, original_filename')
    .eq('id', mediaId)
    .eq('event_id', event.id)
    .single();

  if (!media) return { error: 'Photo not found' };

  // A request whose window has already elapsed is spent: the photo is visible again,
  // so retire it rather than letting it block a fresh request on the same photo.
  await supabase
    .from('takedown_requests')
    .update({ status: 'expired' })
    .eq('event_id', event.id)
    .eq('status', 'pending')
    .lt('auto_restore_at', new Date().toISOString());

  const [{ count: mine }, { count: openForEvent }] = await Promise.all([
    supabase
      .from('takedown_requests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('requester_user_id', user.id)
      .eq('status', 'pending'),
    supabase
      .from('takedown_requests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('status', 'pending'),
  ]);

  if ((mine ?? 0) >= MAX_PENDING_PER_REQUESTER) {
    return { error: `You already have ${MAX_PENDING_PER_REQUESTER} requests awaiting review.` };
  }
  if ((openForEvent ?? 0) >= MAX_PENDING_PER_EVENT) {
    return { error: 'Too many requests are awaiting review on this gallery. Please try later.' };
  }

  const now = Date.now();
  const autoRestoreAt = new Date(now + HIDE_WINDOW_HOURS * 3600_000).toISOString();

  const { data: created, error: insertError } = await supabase
    .from('takedown_requests')
    .insert({
      media_id: mediaId,
      event_id: event.id,
      requester_user_id: user.id,
      requester_email: user.email ?? null,
      reason: reason?.trim() ? reason.trim().slice(0, 1000) : null,
      auto_restore_at: autoRestoreAt,
    })
    .select('id')
    .single();

  if (insertError) {
    // The unique partial index means a second request for the same photo lands here.
    // That is the desired outcome already, so report success rather than an error.
    if (insertError.code === '23505') return { success: true };
    console.error('takedown: insert failed', insertError.message);
    return { error: 'Could not submit your request' };
  }

  // Hide it. Done after the insert so a photo is never hidden without a request
  // recorded to restore it.
  const { error: hideError } = await supabase
    .from('media')
    .update({ takedown_hidden_until: autoRestoreAt })
    .eq('id', mediaId)
    .eq('event_id', event.id);

  if (hideError) {
    console.error('takedown: hide failed', hideError.message);
    await supabase.from('takedown_requests').delete().eq('id', created.id);
    return { error: 'Could not hide the photo' };
  }

  revalidatePath(`/${event.event_hash}`);
  revalidatePath(`/gallery/${event.event_hash}`);

  // Never on the critical path: the photo is already hidden, and the cron retries any
  // request still missing `notified_at`.
  try {
    const sent = await sendTakedownRequestEmail({
      eventId: event.id,
      eventName: event.name,
      eventHash: event.event_hash,
      filename: media.original_filename,
      reason: reason?.trim() || null,
      requesterEmail: user.email ?? null,
    });
    if (sent) {
      await supabase
        .from('takedown_requests')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', created.id);
    }
  } catch (err) {
    console.error('takedown: notification failed', err);
  }

  return { success: true };
}

/** Pending requests for an event, newest first. Organizer-only. */
export async function getTakedownRequests(eventId: string): Promise<TakedownRequestRow[]> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return [];

  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return [];

  const { data } = await supabase
    .from('takedown_requests')
    .select('id, media_id, requester_email, reason, status, created_at, auto_restore_at')
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return (data as TakedownRequestRow[]) ?? [];
}

/** Shared ownership check: returns the request only if the caller owns its event. */
async function loadOwnedRequest(requestId: string, organizerId: string) {
  const supabase = createAdminClient();

  const { data: request } = await supabase
    .from('takedown_requests')
    .select('id, media_id, event_id, status, events!inner(id, organizer_id, event_hash)')
    .eq('id', requestId)
    .single();

  if (!request) return null;
  const event = (request as unknown as { events: { organizer_id: string; event_hash: string } }).events;
  if (!event || event.organizer_id !== organizerId) return null;

  return { supabase, request, event };
}

/**
 * Approve: the photo stays hidden and is hard-deleted once the grace period ends, so a
 * mistaken approval is recoverable until then.
 */
export async function approveTakedown(requestId: string): Promise<{ success?: boolean; error?: string }> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const owned = await loadOwnedRequest(requestId, organizer.id);
  if (!owned) return { error: 'Request not found' };

  const { supabase, request, event } = owned;
  if (request.status !== 'pending') return { error: 'Already resolved' };

  const purgeAt = new Date(Date.now() + PURGE_AFTER_DAYS * 86_400_000).toISOString();

  const { error } = await supabase
    .from('media')
    .update({ takedown_purge_at: purgeAt, takedown_hidden_until: null })
    .eq('id', request.media_id);

  if (error) {
    console.error('takedown: approve failed', error.message);
    return { error: 'Could not remove the photo' };
  }

  await supabase
    .from('takedown_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: organizer.id })
    .eq('id', requestId);

  revalidatePath(`/${event.event_hash}`);
  revalidatePath(`/gallery/${event.event_hash}`);
  revalidatePath(`/events/${request.event_id}/takedowns`);
  return { success: true };
}

/** Decline: restore the photo immediately rather than waiting out the window. */
export async function declineTakedown(requestId: string): Promise<{ success?: boolean; error?: string }> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const owned = await loadOwnedRequest(requestId, organizer.id);
  if (!owned) return { error: 'Request not found' };

  const { supabase, request, event } = owned;
  if (request.status !== 'pending') return { error: 'Already resolved' };

  const { error } = await supabase
    .from('media')
    .update({ takedown_hidden_until: null })
    .eq('id', request.media_id);

  if (error) {
    console.error('takedown: decline failed', error.message);
    return { error: 'Could not restore the photo' };
  }

  await supabase
    .from('takedown_requests')
    .update({ status: 'declined', resolved_at: new Date().toISOString(), resolved_by: organizer.id })
    .eq('id', requestId);

  revalidatePath(`/${event.event_hash}`);
  revalidatePath(`/gallery/${event.event_hash}`);
  revalidatePath(`/events/${request.event_id}/takedowns`);
  return { success: true };
}

/**
 * Hard-delete everything whose grace period has elapsed. Called by the cron; mirrors
 * `deleteMedia` in actions/media.ts — cascades clear face_embeddings and
 * face_processing_jobs, storage is credited back, and R2 failures are tracked for retry.
 */
export async function purgeExpiredTakedowns(): Promise<{ purged: number }> {
  const supabase = createAdminClient();

  const { data: due } = await supabase
    .from('media')
    .select('id, event_id, r2_key, thumbnail_r2_key, preview_r2_key, file_size, variant_size_bytes, events!inner(organizer_id)')
    .not('takedown_purge_at', 'is', null)
    .lt('takedown_purge_at', new Date().toISOString())
    .limit(200);

  if (!due || due.length === 0) return { purged: 0 };

  let purged = 0;
  for (const row of due) {
    const media = row as unknown as {
      id: string; r2_key: string | null; thumbnail_r2_key: string | null;
      preview_r2_key: string | null; file_size: number | null; variant_size_bytes: number | null;
      events: { organizer_id: string };
    };

    const { error } = await supabase.from('media').delete().eq('id', media.id);
    if (error) {
      console.error('takedown purge: delete failed', media.id, error.message);
      continue;
    }
    purged++;

    const bytes = (media.file_size || 0) + (media.variant_size_bytes || 0);
    if (bytes > 0 && media.events?.organizer_id) {
      decrementStorageUsed(media.events.organizer_id, bytes).catch((err) => {
        console.error('takedown purge: storage decrement failed', err);
      });
    }

    const keys = [media.r2_key, media.thumbnail_r2_key, media.preview_r2_key].filter(
      (k): k is string => Boolean(k),
    );
    if (keys.length) deleteR2WithTracking(keys, 'media_delete');
  }

  return { purged };
}
