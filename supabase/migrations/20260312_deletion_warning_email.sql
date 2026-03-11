-- Track when the 1-day-before-deletion warning email was sent.
-- NULL = not yet sent. Cleared when grace period is resolved or cleanup completes.
ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS storage_deletion_warned_at TIMESTAMPTZ;
