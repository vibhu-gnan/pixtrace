'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { nanoid } from 'nanoid';
import { deleteObjects } from '@/lib/storage/r2-client';

export interface EventData {
  id: string;
  organizer_id: string;
  event_hash: string;
  name: string;
  description: string | null;
  event_date: string | null;
  event_end_date: string | null;
  cover_media_id: string | null;
  theme: Record<string, unknown>;
  is_public: boolean;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
  albums?: { id: string; name: string; sort_order: number }[];
  media_count?: number;
  allow_download?: boolean;
  allow_slideshow?: boolean;
  photo_order?: 'oldest_first' | 'newest_first';
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

  // Fetch media counts for all events in parallel (avoids PostgREST 1000-row cap on nested relations)
  const mediaCounts = await Promise.all(
    events.map((event: any) =>
      supabase
        .from('media')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .then(({ count }) => ({ id: event.id, count: count || 0 }))
    )
  );
  const countMap = Object.fromEntries(mediaCounts.map(({ id, count }) => [id, count]));

  return events.map((event: any) => ({
    ...event,
    media_count: countMap[event.id] ?? 0,
  }));
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

  // Read current theme to merge hero config
  const { data: currentEvent } = await supabase
    .from('events')
    .select('theme')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!currentEvent) return { error: 'Event not found' };

  const currentTheme = (currentEvent.theme as Record<string, unknown>) || {};
  const heroMode = payload.heroMode ?? 'single';

  // Build hero config
  const heroConfig: Record<string, unknown> = { mode: heroMode };
  if (heroMode === 'slideshow' && payload.slideshowMediaIds?.length) {
    heroConfig.slideshowMediaIds = payload.slideshowMediaIds;
  }
  if (heroMode === 'slideshow' && payload.mobileSlideshowMediaIds?.length) {
    heroConfig.mobileSlideshowMediaIds = payload.mobileSlideshowMediaIds;
  }
  if (payload.intervalMs) {
    heroConfig.intervalMs = payload.intervalMs;
  }

  // Determine cover_media_id based on mode
  let coverMediaId: string | null = null;
  if (heroMode === 'single') {
    coverMediaId = payload.coverMediaId ?? null;
  } else if (heroMode === 'slideshow' && payload.slideshowMediaIds?.length) {
    // Use first slideshow photo as OG image fallback
    coverMediaId = payload.slideshowMediaIds[0];
  }
  // auto mode: cover_media_id = null (uses first photo fallback)

  const { error } = await supabase
    .from('events')
    .update({
      cover_media_id: coverMediaId,
      theme: { ...currentTheme, hero: heroConfig },
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

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
      // Fire-and-forget — don't block the redirect on R2 cleanup
      deleteObjects(r2Keys).catch((err) => {
        console.error('Error deleting R2 objects:', err);
      });
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
  allowDownloadRequest?: boolean; // Future proofing
  allowViewRequest?: boolean;     // Future proofing
  downloadAccess?: 'everyone' | 'no_one';
  viewAccess?: 'everyone' | 'bmu_id' | 'no_one';
}) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  // Create update object with only defined fields
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.allowDownload !== 'undefined') updates.allow_download = payload.allowDownload;
  if (typeof payload.allowSlideshow !== 'undefined') updates.allow_slideshow = payload.allowSlideshow;

  // Note: view/download access granular controls are UI-only for now until deeper schema implementation
  // We'll trust the checked toggles for the booleans

  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error updating permissions:', error);
    return { error: 'Failed to update permissions' };
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

  const { data: currentEvent } = await supabase
    .from('events')
    .select('theme, event_hash')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!currentEvent) return { error: 'Event not found' };

  const currentTheme = (currentEvent.theme as Record<string, unknown>) || {};

  const { error } = await supabase
    .from('events')
    .update({
      theme: { ...currentTheme, photo_order: safeOrder },
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error updating photo order:', error);
    return { error: 'Failed to update photo order' };
  }

  revalidatePath(`/events/${eventId}/permissions`);
  if (currentEvent.event_hash) {
    revalidatePath(`/gallery/${currentEvent.event_hash}`);
    revalidatePath(`/${currentEvent.event_hash}`);
  }

  return { success: true };
}

export async function updateEventLogo(eventId: string, logoUrl: string | null) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  // Read current theme to avoid overwriting other keys
  const { data: currentEvent } = await supabase
    .from('events')
    .select('theme')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!currentEvent) return { error: 'Event not found' };

  const currentTheme = (currentEvent.theme as Record<string, unknown>) || {};

  // When removing logo, also reset logoDisplay to 'none'
  const updatedTheme = logoUrl
    ? { ...currentTheme, logoUrl }
    : { ...currentTheme, logoUrl, logoDisplay: 'none' };

  const { error } = await supabase
    .from('events')
    .update({
      theme: updatedTheme,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

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

  // Read current theme
  const { data: currentEvent } = await supabase
    .from('events')
    .select('theme, event_hash')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!currentEvent) return { error: 'Event not found' };

  const currentTheme = (currentEvent.theme as Record<string, unknown>) || {};

  const { error } = await supabase
    .from('events')
    .update({
      theme: { ...currentTheme, logoDisplay },
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error updating logo display:', error);
    return { error: 'Failed to update logo display' };
  }

  revalidatePath(`/events/${eventId}`);
  if (currentEvent.event_hash) {
    revalidatePath(`/gallery/${currentEvent.event_hash}`);
    revalidatePath(`/${currentEvent.event_hash}`);
  }

  return { success: true };
}
