-- ============================================================================
-- Admin Role System
-- Adds is_admin flag to organizers for platform administration
-- ============================================================================

-- Add admin role column
ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Partial index — only indexes the (few) rows where is_admin = true
CREATE INDEX IF NOT EXISTS organizers_is_admin_idx
  ON organizers(is_admin) WHERE is_admin = true;
