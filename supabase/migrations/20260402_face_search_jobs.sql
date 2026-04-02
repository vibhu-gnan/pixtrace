-- Async face search job queue.
-- Next.js creates a job and returns the job_id immediately (no Modal call).
-- Modal cron picks up pending jobs every 60s, processes them, writes results back.
-- Jobs expire and are cleaned up after 2 hours.

CREATE TABLE public.face_search_jobs (
  id              uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid     NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  album_id        uuid     REFERENCES public.albums(id) ON DELETE SET NULL,

  -- Selfie image as base64. Nullified after processing to free storage.
  selfie_data     text,

  -- Optional auth info for face profile saving (recall feature).
  auth_user_id    text,
  auth_user_email text,
  auth_user_name  text,

  status          text     NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Stored as {tier1: [{media_id, score}], tier2: [{media_id, score}]}
  -- URLs are generated on-demand by the poll endpoint (presigned URLs expire).
  result          jsonb,
  error           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '2 hours'
);

-- All access via service_role admin client (bypasses RLS).
-- Block direct anon/authenticated access to protect selfie data.
ALTER TABLE public.face_search_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access"
  ON public.face_search_jobs
  USING (false)
  WITH CHECK (false);

-- Index for cron: fast lookup of pending jobs
CREATE INDEX idx_face_search_jobs_pending
  ON public.face_search_jobs (created_at)
  WHERE status = 'pending';

-- Index for cleanup: fast expiry scan
CREATE INDEX idx_face_search_jobs_expires
  ON public.face_search_jobs (expires_at);

-- Index for stuck job detection
CREATE INDEX idx_face_search_jobs_processing
  ON public.face_search_jobs (started_at)
  WHERE status = 'processing';
