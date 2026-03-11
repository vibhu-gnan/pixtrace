'use server';

import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ImportJobData {
  id: string;
  event_id: string;
  organizer_id: string;
  album_id: string | null;
  source: string;
  source_url: string;
  folder_id: string;
  import_mode: 'flat' | 'folder_to_album';
  total_files: number;
  completed: number;
  failed: number;
  skipped: number;
  status: 'pending' | 'listing' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message: string | null;
  cancelled: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function getImportJobs(eventId: string): Promise<ImportJobData[]> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return [];

  const supabase = createAdminClient();

  // Verify event ownership
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) return [];

  const { data } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  return (data as ImportJobData[]) || [];
}

export async function getImportProgress(jobId: string): Promise<ImportJobData | null> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return null;

  const supabase = createAdminClient();

  const { data } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organizer_id', organizer.id)
    .single();

  return (data as ImportJobData) || null;
}

export async function getActiveImportJob(eventId: string): Promise<ImportJobData | null> {
  const organizer = await getCurrentOrganizer();
  if (!organizer) return null;

  const supabase = createAdminClient();

  const { data } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('event_id', eventId)
    .eq('organizer_id', organizer.id)
    .in('status', ['pending', 'listing', 'processing'])
    .limit(1)
    .single();

  return (data as ImportJobData) || null;
}
