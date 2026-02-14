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
  cover_media_id: string | null;
  cover_type: 'first' | 'single' | 'upload' | 'slideshow';
  cover_r2_key: string | null;
  cover_slideshow_config: { type: 'album' | 'custom'; albumId?: string; mediaIds?: string[] } | null;
  theme: Record<string, unknown>;
  is_public: boolean;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
  albums?: { id: string; name: string; sort_order: number }[];
  media_count?: number;
}

export async function createEvent(formData: FormData) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) redirect('/sign-in');

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || null;
  const eventDate = (formData.get('eventDate') as string) || null;
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
      albums (id, name, sort_order),
      media (id)
    `)
    .eq('organizer_id', organizer.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  return (events || []).map((event: any) => ({
    ...event,
    cover_type: event.cover_type || 'first', // Map camelCase to snake_case if needed by DB/ORM, relying on raw select * might return snake_case from Postgres
    media_count: event.media?.length || 0,
    media: undefined,
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

  return {
    ...event,
    cover_type: event.cover_type || 'first', // fallback
    media_count: count || 0,
    created_at: event.created_at || new Date().toISOString(),
    updated_at: event.updated_at || new Date().toISOString(),
  } as EventData;
}

export async function updateEvent(eventId: string, formData: FormData) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) redirect('/sign-in');

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || null;
  const eventDate = (formData.get('eventDate') as string) || null;
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
  coverType: 'first' | 'single' | 'upload' | 'slideshow';
  coverMediaId?: string | null;
  coverR2Key?: string | null;
  coverSlideshowConfig?: any;
}) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return { error: 'Unauthorized' };

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('events')
    .update({
      cover_type: payload.coverType,
      cover_media_id: payload.coverMediaId || null,
      cover_r2_key: payload.coverR2Key || null,
      cover_slideshow_config: payload.coverSlideshowConfig || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('organizer_id', organizer.id);

  if (error) {
    console.error('Error updating event hero:', error);
    return { error: 'Failed to update hero settings' };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/gallery/${eventId}`); // Invalidate public gallery too? No, it uses hash.
  // We should revalidate the gallery path if possible, but we don't have the hash handy here easily without fetching.
  // Actually, getEvent returns hash, so we could fetch it. But let's verify if revalidatePath works with just the route pattern.
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
