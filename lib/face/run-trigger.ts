import { createAdminClient } from '@/lib/supabase/admin';

export interface TriggerResult {
  dispatched: number;
  total_claimed: number;
  errors?: string[];
}

/**
 * Face processing runs on the self-hosted local worker (worker/face_worker.py),
 * which polls the `face_processing_jobs` queue directly and embeds faces on a
 * local GPU. The app therefore no longer dispatches work to a remote GPU (Modal).
 *
 * Uploads already insert jobs as `status = 'pending'`; the worker claims them on
 * its next poll (a few seconds). This function is kept as a thin no-op so every
 * existing caller — upload/complete, reprocessFaceEmbeddings, the "process faces"
 * button (triggerFaceProcessing), and the /api/face/trigger cron — keeps working
 * without change. It performs NO remote dispatch. It only reports how many jobs
 * are currently queued so the UI can show meaningful feedback.
 */
export async function runTrigger(): Promise<TriggerResult> {
  const supabase = createAdminClient();

  // Count jobs currently waiting for the local worker (UI feedback only).
  // No remote call, no status writes — the worker owns claiming/processing.
  const { count, error } = await supabase
    .from('face_processing_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('runTrigger: failed to count pending jobs:', error.message);
    return { dispatched: 0, total_claimed: 0, errors: [error.message] };
  }

  const queued = count ?? 0;
  return { dispatched: queued, total_claimed: queued };
}
