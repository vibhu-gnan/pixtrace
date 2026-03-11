'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { nanoid } from 'nanoid';
import { deleteR2WithTracking } from '@/lib/storage/r2-cleanup';
import { getOrganizerPlanLimits, canCreateEvent, hasFeature } from '@/lib/plans/limits';
import { getPreviewUrl } from '@/lib/storage/cloudflare-images';

export interface EventData {
  id: string;
  organizer_id: string;
  event_hash: string;
  name: string;
  description: string | null;
  event_date: string | null;
  event_end_date: string | null;
  cover_media_id: string | null;
  cover_url?: string | null;
  theme: Record<string, unknown>;
  is_public: boolean;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
  albums?: { id: string; name: string; sort_order: number }[];
  media_count?: number;
  allow_download?: boolean;
  allow_slideshow?: boolean;
  face_search_enabled?: boolean;
  show_face_scores?: boolean;
  photo_order?: 'oldest_first' | 'newest_first';
}

/**
 * Batch-resolve cover image presigned URLs for a list of events.
 * Only fetches media records for events that have a cover_media_id set.
 */
async function resolveCoverUrls(
  events: any[],
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Record<string, string>> {
  const coverIds = events
    .map((e) => e.cover_media_id)
    .filter((id): id is string => !!id);

  if (coverIds.length === 0) return {};

  const { data: mediaRows } = await supabase
    .from('media')
    .select('id, r2_key, preview_r2_key')
    .in('id', coverIds);

  if (!mediaRows || mediaRows.length === 0) return {};

  // Generate presigned URLs in parallel
  const entries = await Promise.all(
    mediaRows.map(async (m: any) => {
      const url = await getPreviewUrl(m.r2_key, m.preview_r2_key);
      return [m.id, url] as [string, string];
    }),
  );

  return Object.fromEntries(entries.filter(([, url]) => !!url));
}

export async function createEvent(formData: FormData) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) redirect('/sign-in');

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || null;
  const eventDate = (formData.get('eventDate') as string) || null;
  const eventEndDate = (formData.get('eventEndDate') as string) || null;
  // Events start as private drafts — published via "Publish Event" button
  const isPublic = false;

  if (!name?.trim()) {
    return { error: 'Event name is required' };
  }

  // Check plan limits
  const limits = await getOrganizerPlanLimits(organizer.id);
  const eventCheck = canCreateEvent(limits);
  if (!eventCheck.allowed) {
    return { error: eventCheck.reason };
  }

  const supabase = createAdminClient();
  const eventHash = nanoid(12);

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      organizer_id: organizer.id,
      event_hash: eventHash,
      name: name.trim(),
      description,
      event_date: eventDate || null,
      event_end_date: eventEndDate || null,
      is_public: isPublic,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    return { error: 'Failed to create event' };
  }

  // Create a default album (rollback event if this fails to avoid partial state)
  const { error: albumError } = await supabase.from('albums').insert({
    event_id: event.id,
    name: 'All Photos',
    sort_order: 0,
  });

  if (albumError) {
    await supabase.from('events').delete().eq('id', event.id);
    console.error('Error creating default album:', albumError);
    return { error: 'Failed to create event (default album)' };
  }

  revalidatePath('/dashboard');
  redirect(`/events/${event.id}`);
}

export async function getEvents(): Promise<EventData[]> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return [];

  const supabase = createAdminClient();

  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      albums (id, name, sort_order)
    `)
    .eq('organizer_id', organizer.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  if (!events || events.length === 0) return [];

  // Batch fetch media counts + cover URLs in parallel (avoids N+1)
  // Use RPC or per-event HEAD counts in controlled batches (max 10 concurrent)
  const MAX_CONCURRENT = 10;
  const countMap: Record<string, number> = {};

  const [, coverUrlMap] = await Promise.all([
    (async () => {
      for (let i = 0; i < events.length; i += MAX_CONCURRENT) {
        const batch = events.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.all(
          batch.map((event: any) =>
            supabase
              .from('media')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .then(({ count }) => ({ id: event.id, count: count || 0 }))
          )
        );
        for (const { id, count } of results) {
          countMap[id] = count;
        }
      }
    })(),
    resolveCoverUrls(events, supabase),
  ]);

  return events.map((event: any) => ({
    ...event,
    media_count: countMap[event.id] ?? 0,
    cover_url: event.cover_media_id ? (coverUrlMap[event.cover_media_id] || null) : null,
  }));
}

const EVENTS_PAGE_SIZE = 50;

export async function getDashboardStats(organizerId: string): Promise<{
  totalPhotos: number;
  totalViews: number;
}> {
  const supabase = createAdminClient();

  // Single query: sum media_count and view_count across all organizer events
  const { data } = await supabase
    .from('events')
    .select('media_count:media(count), view_count')
    .eq('organizer_id', organizerId);

  if (!data || data.length === 0) return { totalPhotos: 0, totalViews: 0 };

  let totalPhotos = 0;
  let totalViews = 0;
  for (const row of data) {
    totalViews += (row as any).view_count || 0;
    const mc = (row as any).media_count;
    totalPhotos += Array.isArray(mc) && mc[0] ? mc[0].count : 0;
  }

  return { totalPhotos, totalViews };
}

export async function getEventsPage(
  cursor?: string | null,
  limit: number = EVENTS_PAGE_SIZE,
): Promise<{ events: EventData[]; hasMore: boolean }> {
  limit = Math.max(1, Math.min(limit, 200)); // Clamp to safe range

  const organizer = await getCurrentOrganizer();
  if (!organizer) return { events: [], hasMore: false };

  const supabase = createAdminClient();

  let query = supabase
    .from('events')
    .select(`*, albums (id, name, sort_order)`)
    .eq('organizer_id', organizer.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }); // Deterministic tiebreaker

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: events, error } = await query.limit(limit + 1);

  if (error) {
    console.error('Error fetching events page:', error);
    return { events: [], hasMore: false };
  }

  if (!events || events.length === 0) return { events: [], hasMore: false };

  const hasMore = events.length > limit;
  const pageEvents = hasMore ? events.slice(0, limit) : events;

  // Batch fetch media counts + cover URLs in parallel (avoids N+1 with controlled concurrency)
  const MAX_CONCURRENT = 10;
  const countMap: Record<string, number> = {};

  const [, coverUrlMap] = await Promise.all([
    (async () => {
      for (let i = 0; i < pageEvents.length; i += MAX_CONCURRENT) {
        const batch = pageEvents.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.all(
          batch.map((event: any) =>
            supabase
              .from('media')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .then(({ count }) => ({ id: event.id, count: count || 0 }))
          )
        );
        for (const { id, count } of results) {
          countMap[id] = count;
        }
      }
    })(),
    resolveCoverUrls(pageEvents, supabase),
  ]);

  return {
    events: pageEvents.map((event: any) => ({
      ...event,
      media_count: countMap[event.id] ?? 0,
      cover_url: event.cover_media_id ? (coverUrlMap[event.cover_media_id] || null) : null,
    })),
    hasMore,
  };
}

export async function getEvent(eventId: string): Promise<EventData | null> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return null;

  const supabase = createAdminClient();

  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      albums (id, name, sort_order, description)
    `)
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (error) {
    console.error('Error fetching event:', error);
    return null;
  }

  // Get media count
  const { count } = await supabase
    .from('media')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  const theme = (event.theme as Record<string, unknown>) || {};
  const rawOrder = theme.photo_order;
  return {
    ...event,
    media_count: count || 0,
    created_at: event.created_at || new Date().toISOString(),
    updated_at: event.updated_at || new Date().toISOString(),
    photo_order: rawOrder === 'newest_first' ? 'newest_first' : 'oldest_first',
  } as EventData;
}

export async function updateEvent(eventId: string, formData: FormData) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) redirect('/sign-in');

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || null;
  const eventDate = (formData.get('eventDate') as string) || null;
  const eventEndDate = (formData.get('eventEndDate') as string) || null;
  const isPublic = formData.has('isPublic');

  if (!name?.trim()) {
    return { error: 'Event name is required' };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('events')
    .update({
      name: name.trim(),
      description,
      event_date: eventDate || null,
      event_end_date: eventEndDate || null,
      is_public: isPublic,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error updating event:', error);
    return { error: 'Failed to update event' };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateEventHero(eventId: string, payload: {
  coverMediaId?: string | null;
  heroMode?: 'single' | 'slideshow' | 'auto';
  slideshowMediaIds?: string[];
  mobileSlideshowMediaIds?: string[];
  intervalMs?: number;
}) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  // Verify ownership
  const { data: currentEvent } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!currentEvent) return { error: 'Event not found' };

  const heroMode = payload.heroMode ?? 'single';

  // Build hero config
  const heroConfig: Record<string, unknown> = { mode: heroMode };
  if (heroMode === 'slideshow' && payload.slideshowMediaIds?.length) {
    // Verify all media IDs belong to this event (prevent cross-event IDOR)
    const { data: validMedia } = await supabase
      .from('media')
      .select('id')
      .eq('event_id', eventId)
      .in('id', payload.slideshowMediaIds);
    const validIds = new Set((validMedia || []).map((m: any) => m.id));
    heroConfig.slideshowMediaIds = payload.slideshowMediaIds.filter(id => validIds.has(id));
  }
  if (heroMode === 'slideshow' && payload.mobileSlideshowMediaIds?.length) {
    const { data: validMobile } = await supabase
      .from('media')
      .select('id')
      .eq('event_id', eventId)
      .in('id', payload.mobileSlideshowMediaIds);
    const validMobileIds = new Set((validMobile || []).map((m: any) => m.id));
    heroConfig.mobileSlideshowMediaIds = payload.mobileSlideshowMediaIds.filter(id => validMobileIds.has(id));
  }
  if (payload.intervalMs) {
    heroConfig.intervalMs = payload.intervalMs;
  }

  // Determine cover_media_id based on mode
  let coverMediaId: string | null = null;
  if (heroMode === 'single') {
    coverMediaId = payload.coverMediaId ?? null;
  } else if (heroMode === 'slideshow' && payload.slideshowMediaIds?.length) {
    coverMediaId = payload.slideshowMediaIds[0];
  }

  // Atomic theme merge + cover_media_id update in parallel
  const [themeResult, coverResult] = await Promise.all([
    supabase.rpc('merge_event_theme', {
      p_event_id: eventId,
      p_organizer_id: organizer.id,
      p_theme_patch: { hero: heroConfig },
    }),
    supabase
      .from('events')
      .update({ cover_media_id: coverMediaId, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('organizer_id', organizer.id),
  ]);

  const error = themeResult.error || coverResult.error;

  if (error) {
    console.error('Error updating event hero:', error);
    return { error: 'Failed to update hero settings' };
  }

  // Get event_hash to revalidate public gallery cache
  const { data: evt } = await supabase
    .from('events')
    .select('event_hash')
    .eq('id', eventId)
    .single();

  revalidatePath(`/events/${eventId}`);
  if (evt?.event_hash) {
    revalidatePath(`/gallery/${evt.event_hash}`);
    revalidatePath(`/${evt.event_hash}`);
  }
  return { success: true };
}

export async function deleteEvent(eventId: string) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) redirect('/sign-in');

  const supabase = createAdminClient();

  // 1. Verify event belongs to organizer
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) {
    return { error: 'Event not found' };
  }

  // 2. Fetch all R2 keys BEFORE deleting from DB (cascade will remove media rows)
  const { data: mediaRows } = await supabase
    .from('media')
    .select('r2_key, thumbnail_r2_key, preview_r2_key')
    .eq('event_id', eventId);

  // 3. Delete event from DB (cascades to albums → media)
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error deleting event:', error);
    return { error: 'Failed to delete event' };
  }

  // 4. Delete files from R2 storage (non-blocking — DB is source of truth)
  if (mediaRows && mediaRows.length > 0) {
    const r2Keys: string[] = [];
    for (const row of mediaRows) {
      if (row.r2_key) r2Keys.push(row.r2_key);
      if (row.thumbnail_r2_key) r2Keys.push(row.thumbnail_r2_key);
      if (row.preview_r2_key) r2Keys.push(row.preview_r2_key);
    }
    if (r2Keys.length > 0) {
      // Fire-and-forget with orphan tracking — don't block the redirect
      deleteR2WithTracking(r2Keys, 'event_delete');
    }
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function publishEvent(eventId: string): Promise<{ error?: string; galleryUrl?: string; eventHash?: string }> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Not authenticated' };

  const supabase = createAdminClient();

  // Verify ownership & get event_hash
  const { data: event } = await supabase
    .from('events')
    .select('id, event_hash, is_public')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return { error: 'Event not found' };
  if (event.is_public) {
    return {
      eventHash: event.event_hash,
      galleryUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/gallery/${event.event_hash}`,
    };
  }

  const { error } = await supabase
    .from('events')
    .update({ is_public: true, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error publishing event:', error);
    return { error: 'Failed to publish event' };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/dashboard');

  return {
    eventHash: event.event_hash,
    galleryUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/gallery/${event.event_hash}`,
  };
}

export async function unpublishEvent(eventId: string): Promise<{ error?: string }> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Not authenticated' };

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('events')
    .update({ is_public: false, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error unpublishing event:', error);
    return { error: 'Failed to unpublish event' };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/dashboard');
  return {};
}

export async function updateEventPermissions(eventId: string, payload: {
  allowDownload?: boolean;
  allowSlideshow?: boolean;
  faceSearchEnabled?: boolean;
  showFaceScores?: boolean;
  allowDownloadRequest?: boolean; // Future proofing
  allowViewRequest?: boolean;     // Future proofing
  downloadAccess?: 'everyone' | 'no_one';
  viewAccess?: 'everyone';
}) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  // Check plan feature flags before allowing premium toggles
  if (payload.allowDownload === true) {
    const limits = await getOrganizerPlanLimits(organizer.id);
    if (!hasFeature(limits, 'downloads')) {
      return { error: `Downloads are not available on your ${limits.planName} plan. Upgrade to enable downloads.` };
    }
  }

  const supabase = createAdminClient();

  // Create update object with only defined fields
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.allowDownload !== 'undefined') updates.allow_download = payload.allowDownload;
  if (typeof payload.allowSlideshow !== 'undefined') updates.allow_slideshow = payload.allowSlideshow;
  if (typeof payload.faceSearchEnabled !== 'undefined') updates.face_search_enabled = payload.faceSearchEnabled;
  if (typeof payload.showFaceScores !== 'undefined') updates.show_face_scores = payload.showFaceScores;

  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error updating permissions:', error);
    return { error: 'Failed to update permissions' };
  }

  // When face search is enabled, trigger processing of ALL pending jobs.
  // This is non-blocking: we fire the trigger and don't wait for it to complete.
  // The trigger route itself loops through all batches and handles Modal cold starts.
  if (payload.faceSearchEnabled === true) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    if (baseUrl) {
      fetch(`${baseUrl}/api/face/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Face-Secret': process.env.FACE_PROCESSING_SECRET || '',
        },
      })
        .then(async (resp) => {
          if (!resp.ok) {
            console.error('Face trigger failed:', resp.status, await resp.text().catch(() => ''));
          } else {
            const data = await resp.json().catch(() => null);
            console.log('Face trigger result:', data);
          }
        })
        .catch((err) => {
          console.error('Face trigger error:', err);
        });
    }
  }

  // Get event_hash to revalidate public gallery
  const { data: evt } = await supabase
    .from('events')
    .select('event_hash')
    .eq('id', eventId)
    .single();

  if (evt?.event_hash) {
    revalidatePath(`/gallery/${evt.event_hash}`);
    revalidatePath(`/${evt.event_hash}`);
  }
  revalidatePath(`/events/${eventId}/permissions`);

  return { success: true };
}

export async function updateEventPhotoOrder(eventId: string, order: 'oldest_first' | 'newest_first') {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const safeOrder = order === 'newest_first' ? 'newest_first' : 'oldest_first';

  const supabase = createAdminClient();

  // Atomic merge — no read-then-write race condition
  const { error } = await supabase.rpc('merge_event_theme', {
    p_event_id: eventId,
    p_organizer_id: organizer.id,
    p_theme_patch: { photo_order: safeOrder },
  });

  if (error) {
    console.error('Error updating photo order:', error);
    return { error: 'Failed to update photo order' };
  }

  // Get event_hash for revalidation
  const { data: evt } = await supabase
    .from('events')
    .select('event_hash')
    .eq('id', eventId)
    .single();

  revalidatePath(`/events/${eventId}/permissions`);
  if (evt?.event_hash) {
    revalidatePath(`/gallery/${evt.event_hash}`);
    revalidatePath(`/${evt.event_hash}`);
  }

  return { success: true };
}

export async function updateEventLogo(eventId: string, logoUrl: string | null) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  // Check plan feature flag — setting a logo requires custom_branding
  if (logoUrl) {
    const limits = await getOrganizerPlanLimits(organizer.id);
    if (!hasFeature(limits, 'custom_branding')) {
      return { error: `Custom branding is not available on your ${limits.planName} plan. Upgrade to add a logo.` };
    }
  }

  // Validate URL scheme — only allow https: or R2 keys (no protocol)
  if (logoUrl) {
    const isAbsoluteUrl = logoUrl.startsWith('http://') || logoUrl.startsWith('https://');
    if (isAbsoluteUrl && !logoUrl.startsWith('https://')) {
      return { error: 'Logo URL must use HTTPS' };
    }
    // Block dangerous schemes (javascript:, data:, etc.)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(logoUrl) && !isAbsoluteUrl) {
      return { error: 'Invalid logo URL' };
    }
  }

  const supabase = createAdminClient();

  // Atomic merge — when removing logo, also reset logoDisplay to 'none'
  const patch = logoUrl
    ? { logoUrl }
    : { logoUrl: null, logoDisplay: 'none' };

  const { error } = await supabase.rpc('merge_event_theme', {
    p_event_id: eventId,
    p_organizer_id: organizer.id,
    p_theme_patch: patch,
  });

  if (error) {
    console.error('Error updating event logo:', error);
    return { error: 'Failed to update logo' };
  }

  // Get event_hash to revalidate public gallery
  const { data: evt } = await supabase
    .from('events')
    .select('event_hash')
    .eq('id', eventId)
    .single();

  revalidatePath(`/events/${eventId}`);
  if (evt?.event_hash) {
    revalidatePath(`/gallery/${evt.event_hash}`);
    revalidatePath(`/${evt.event_hash}`);
  }

  return { success: true };
}

const VALID_LOGO_DISPLAYS = ['cover_and_loading', 'loading_only', 'none'] as const;
type LogoDisplayValue = typeof VALID_LOGO_DISPLAYS[number];

export async function updateEventLogoDisplay(eventId: string, logoDisplay: string) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  // Validate input
  if (!VALID_LOGO_DISPLAYS.includes(logoDisplay as LogoDisplayValue)) {
    return { error: 'Invalid logo display option' };
  }

  const supabase = createAdminClient();

  // Atomic merge — no read-then-write race condition
  const { error } = await supabase.rpc('merge_event_theme', {
    p_event_id: eventId,
    p_organizer_id: organizer.id,
    p_theme_patch: { logoDisplay },
  });

  if (error) {
    console.error('Error updating logo display:', error);
    return { error: 'Failed to update logo display' };
  }

  const { data: evt } = await supabase
    .from('events')
    .select('event_hash')
    .eq('id', eventId)
    .single();

  revalidatePath(`/events/${eventId}`);
  if (evt?.event_hash) {
    revalidatePath(`/gallery/${evt.event_hash}`);
    revalidatePath(`/${evt.event_hash}`);
  }

  return { success: true };
}

const MAX_PRELOADER_SIZE = 51200; // 50KB

// Sanitize HTML to prevent stored XSS — strip dangerous tags, attributes, and protocols.
// Uses layered regex approach (safe for Node.js server actions without DOM dependencies).
function sanitizePreloaderHtml(html: string): string {
  return html
    // 1. Remove <script> tags and their content (including nested/malformed/unclosed)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '')
    // 1b. Remove any remaining <script> opening tags (unclosed script tags)
    .replace(/<script\b[^>]*>/gi, '')
    // 2. Remove ALL event handler attributes — match on\w+ with any quote style or unquoted
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // 3. Remove javascript:/data:/vbscript: in href/src/action/xlink:href/formaction attrs
    .replace(/(href|src|action|xlink:href|formaction)\s*=\s*(?:"(?:javascript|data|vbscript)\s*:[^"]*"|'(?:javascript|data|vbscript)\s*:[^']*')/gi, '$1=""')
    // 4. Remove dangerous tags: iframe, object, embed, form, meta, link, base, applet, template
    .replace(/<\/?(iframe|object|embed|form|meta|link|base|applet|template)\b[^>]*>/gi, '')
    // 5. Remove <svg> event attributes that bypass on* filtering (set/animate onbegin etc.)
    .replace(/<(set|animate\w*)\b[^>]*\bon\w+[^>]*>/gi, '')
    // 6. Remove style expressions (IE) and -moz-binding (Firefox)
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/-moz-binding\s*:/gi, '-blocked:')
    // 7. Remove url() in style attributes pointing to javascript:/data:
    .replace(/url\s*\(\s*(?:"|')?(?:javascript|data)\s*:/gi, 'url(blocked:');
}

export async function updateEventCustomPreloader(eventId: string, html: string | null) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  // Check plan feature flag — custom preloader requires custom_branding
  if (html) {
    const limits = await getOrganizerPlanLimits(organizer.id);
    if (!hasFeature(limits, 'custom_branding')) {
      return { error: `Custom branding is not available on your ${limits.planName} plan. Upgrade to use custom preloaders.` };
    }
  }

  // Validate size
  if (html && html.length > MAX_PRELOADER_SIZE) {
    return { error: 'Custom preloader HTML must be under 50KB' };
  }

  // Sanitize HTML to prevent stored XSS
  const sanitizedHtml = html ? sanitizePreloaderHtml(html) : null;

  const supabase = createAdminClient();

  // Atomic merge — set or clear the custom preloader
  const { error } = await supabase.rpc('merge_event_theme', {
    p_event_id: eventId,
    p_organizer_id: organizer.id,
    p_theme_patch: { customPreloader: sanitizedHtml },
  });

  if (error) {
    console.error('Error updating custom preloader:', error);
    return { error: 'Failed to update custom preloader' };
  }

  const { data: evt } = await supabase
    .from('events')
    .select('event_hash')
    .eq('id', eventId)
    .single();

  revalidatePath(`/events/${eventId}`);
  if (evt?.event_hash) {
    revalidatePath(`/gallery/${evt.event_hash}`);
    revalidatePath(`/${evt.event_hash}`);
  }

  return { success: true };
}

export interface FaceProcessingProgress {
  total: number;
  completed: number;
  failed: number;
  noFaces: number;
  pending: number;
  processing: number;
}

export async function getFaceProcessingProgress(eventId: string): Promise<FaceProcessingProgress | null> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return null;

  const supabase = createAdminClient();

  // Verify ownership
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return null;

  // Get counts by status
  const { data: jobs } = await supabase
    .from('face_processing_jobs')
    .select('status')
    .eq('event_id', eventId);

  if (!jobs) return { total: 0, completed: 0, failed: 0, noFaces: 0, pending: 0, processing: 0 };

  const total = jobs.length;
  const completed = jobs.filter((j: any) => j.status === 'completed').length;
  const failed = jobs.filter((j: any) => j.status === 'failed').length;
  const noFaces = jobs.filter((j: any) => j.status === 'no_faces').length;
  const pending = jobs.filter((j: any) => j.status === 'pending').length;
  const processing = jobs.filter((j: any) => j.status === 'processing').length;

  return { total, completed, failed, noFaces, pending, processing };
}
