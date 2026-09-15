-- ─────────────────────────────────────────────────────────────────────────────
-- Webhook dead-letter table
-- Stores failed webhook events so they can be replayed manually.
-- Razorpay will also retry (returns 500), but this gives us a persistent record.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_dead_letters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT NOT NULL DEFAULT 'razorpay',
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  error_message TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Index for finding unresolved failures quickly
CREATE INDEX IF NOT EXISTS idx_webhook_dead_letters_unresolved
  ON webhook_dead_letters (provider, resolved, created_at DESC)
  WHERE resolved = false;

-- RLS: only service role can read/write (no public access)
ALTER TABLE webhook_dead_letters ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- R2 orphan tracking table
-- When R2 cleanup fails after DB deletion, we log the orphaned keys here
-- so the cleanup script (or a future cron) can retry them.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS r2_orphaned_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  r2_key      TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'delete_cleanup',  -- 'delete_cleanup', 'event_delete', 'album_delete'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  cleaned_at  TIMESTAMPTZ  -- set when actually deleted from R2
);

-- Index for finding un-cleaned orphans
CREATE INDEX IF NOT EXISTS idx_r2_orphaned_keys_pending
  ON r2_orphaned_keys (cleaned_at)
  WHERE cleaned_at IS NULL;

-- Unique on r2_key to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_r2_orphaned_keys_unique_key
  ON r2_orphaned_keys (r2_key)
  WHERE cleaned_at IS NULL;

-- RLS: only service role can read/write
ALTER TABLE r2_orphaned_keys ENABLE ROW LEVEL SECURITY;
