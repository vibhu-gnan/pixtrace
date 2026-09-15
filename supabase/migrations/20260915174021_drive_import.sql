-- ============================================================
-- Google Drive Import Jobs
-- Tracks bulk photo imports from Google Drive folders
-- ============================================================

CREATE TABLE import_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id    UUID NOT NULL REFERENCES organizers(id),
  album_id        UUID REFERENCES albums(id) ON DELETE CASCADE,  -- NULL if folder_to_album mode
  source          TEXT NOT NULL DEFAULT 'google_drive',
  source_url      TEXT NOT NULL,
  folder_id       TEXT NOT NULL,
  import_mode     TEXT NOT NULL DEFAULT 'flat'
                  CHECK (import_mode IN ('flat', 'folder_to_album')),
  total_files     INT NOT NULL DEFAULT 0,
  completed       INT NOT NULL DEFAULT 0,
  failed          INT NOT NULL DEFAULT 0,
  skipped         INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'listing', 'processing', 'completed', 'failed', 'cancelled')),
  error_message   TEXT,
  cancelled       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_import_jobs_event ON import_jobs(event_id);
CREATE INDEX idx_import_jobs_organizer_status ON import_jobs(organizer_id, status);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Organizers can read their own import jobs
CREATE POLICY "organizers_read_own_imports"
  ON import_jobs FOR SELECT
  USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE auth_id = auth.uid()::text
    )
  );

-- Organizers can insert their own import jobs
CREATE POLICY "organizers_insert_own_imports"
  ON import_jobs FOR INSERT
  WITH CHECK (
    organizer_id IN (
      SELECT id FROM organizers WHERE auth_id = auth.uid()::text
    )
  );

-- Organizers can update their own import jobs (for cancellation)
CREATE POLICY "organizers_update_own_imports"
  ON import_jobs FOR UPDATE
  USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE auth_id = auth.uid()::text
    )
  );

-- Service role bypasses RLS automatically (used by Modal)
