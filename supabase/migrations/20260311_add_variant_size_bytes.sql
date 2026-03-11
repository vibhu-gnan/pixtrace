-- Add variant_size_bytes to media table so deletion can accurately decrement storage.
-- Previously only file_size (original) was stored; variant (thumbnail + preview) sizes
-- were counted during upload but lost — causing permanent drift on every delete.

ALTER TABLE media
  ADD COLUMN IF NOT EXISTS variant_size_bytes BIGINT NOT NULL DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN media.variant_size_bytes IS 'Total bytes of generated variants (thumbnail + preview). Used to accurately decrement storage_used_bytes on deletion.';

-- Backfill: estimate variant sizes for existing rows that have preview/thumbnail keys.
-- We can't know the exact blob sizes retroactively, so we estimate ~15% of original for
-- preview and ~2% for thumbnail (based on typical WebP compression ratios).
-- This is better than 0 (which causes permanent drift on every future delete).
UPDATE media
SET variant_size_bytes = (
  CASE
    WHEN preview_r2_key IS NOT NULL AND thumbnail_r2_key IS NOT NULL
      THEN GREATEST(1, (file_size * 17) / 100)  -- ~17% of original
    WHEN preview_r2_key IS NOT NULL
      THEN GREATEST(1, (file_size * 15) / 100)  -- ~15% of original
    WHEN thumbnail_r2_key IS NOT NULL
      THEN GREATEST(1, (file_size * 2) / 100)   -- ~2% of original
    ELSE 0
  END
)
WHERE (preview_r2_key IS NOT NULL OR thumbnail_r2_key IS NOT NULL)
  AND variant_size_bytes = 0;
