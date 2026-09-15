-- Storage overage grace period
-- When a user exceeds their plan's storage limit (e.g., after downgrade),
-- they get a 30-day grace period before excess content is auto-deleted.

ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS storage_grace_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_grace_notified_at TIMESTAMPTZ;

-- Partial index for efficient cron queries (only rows with active grace periods)
CREATE INDEX IF NOT EXISTS idx_organizers_storage_grace
  ON organizers (storage_grace_deadline)
  WHERE storage_grace_deadline IS NOT NULL;
