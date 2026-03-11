-- ============================================================
-- Admin Custom Limits for Enterprise Users
-- Adds per-user override columns to organizers table
-- NULL = use plan defaults, non-null = override
-- ============================================================

ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS custom_storage_limit_bytes bigint,
  ADD COLUMN IF NOT EXISTS custom_max_events integer,
  ADD COLUMN IF NOT EXISTS custom_feature_flags jsonb;

COMMENT ON COLUMN organizers.custom_storage_limit_bytes IS 'Admin override for storage limit. NULL = use plan default.';
COMMENT ON COLUMN organizers.custom_max_events IS 'Admin override for max events. NULL = use plan default. 0 = unlimited.';
COMMENT ON COLUMN organizers.custom_feature_flags IS 'Admin override for feature flags. Merged with plan defaults (overrides win).';
