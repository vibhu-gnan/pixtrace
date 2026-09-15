-- ============================================================
-- Photo takedown requests
--
-- A signed-in gallery visitor asks for a photo of themselves to be removed. The
-- photo hides immediately, the organizer is emailed, and either approves it —
-- hidden now, hard-deleted after 30 days — or the photo comes back on its own
-- after 6 hours if nothing happens.
-- ============================================================

-- ── Visibility state lives on media ─────────────────────────
-- Storing the restore moment as a timestamp means the 6-hour window needs no
-- background job at all: the photo reappears when now() passes it. Nothing to
-- schedule, stall, or miss.
ALTER TABLE media ADD COLUMN IF NOT EXISTS takedown_hidden_until TIMESTAMPTZ;
ALTER TABLE media ADD COLUMN IF NOT EXISTS takedown_purge_at TIMESTAMPTZ;

COMMENT ON COLUMN media.takedown_hidden_until IS
  'Hidden from public view until this moment. Set to now()+6h while a takedown request is pending, cleared when declined. Restore is implicit — no job required.';
COMMENT ON COLUMN media.takedown_purge_at IS
  'Set when a takedown is approved: hidden permanently, then hard-deleted by the cron once this moment passes.';

-- Only hidden rows are ever scanned by these, so keep the indexes partial.
CREATE INDEX IF NOT EXISTS media_takedown_hidden_idx
  ON media (takedown_hidden_until) WHERE takedown_hidden_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_takedown_purge_idx
  ON media (takedown_purge_at) WHERE takedown_purge_at IS NOT NULL;

-- ── Requests ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS takedown_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Requests are restricted to signed-in visitors so they are accountable and
  -- can be rate limited per person.
  requester_user_id TEXT NOT NULL,
  requester_email TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auto_restore_at TIMESTAMPTZ NOT NULL,
  -- Stamped only once the notification actually sent, so the cron can retry the
  -- ones that did not.
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES organizers(id)
);

-- A photo can only have one request in flight. Makes a duplicate submission a
-- no-op rather than a second hide, and closes the concurrent-insert race.
CREATE UNIQUE INDEX IF NOT EXISTS takedown_requests_one_pending_per_media
  ON takedown_requests (media_id) WHERE status = 'pending';

-- Organizer's pending queue.
CREATE INDEX IF NOT EXISTS takedown_requests_event_status_idx
  ON takedown_requests (event_id, status, created_at DESC);

-- Per-requester rate limiting.
CREATE INDEX IF NOT EXISTS takedown_requests_requester_idx
  ON takedown_requests (requester_user_id, event_id) WHERE status = 'pending';

-- Notification retry sweep.
CREATE INDEX IF NOT EXISTS takedown_requests_unnotified_idx
  ON takedown_requests (created_at) WHERE status = 'pending' AND notified_at IS NULL;

-- Written and read only through the service role in server actions, so no policy
-- grants access; RLS on with none defined denies anon and authenticated outright.
ALTER TABLE takedown_requests ENABLE ROW LEVEL SECURITY;

-- ── Hide at the lowest level available ──────────────────────
-- Extending the public SELECT policy means every anon-key read is filtered in one
-- place, including queries not yet written. Admin-client paths bypass RLS and are
-- filtered explicitly in application code.
-- The organizers' own ALL policy is deliberately left alone: they must still see
-- a hidden photo in order to act on the request.
DROP POLICY IF EXISTS "Public can view media for public events" ON media;
CREATE POLICY "Public can view media for public events" ON media
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE is_public = true)
    AND (takedown_hidden_until IS NULL OR takedown_hidden_until <= NOW())
    AND takedown_purge_at IS NULL
  );
