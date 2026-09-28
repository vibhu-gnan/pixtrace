-- ============================================================
-- Per-event watermark
-- ============================================================
--
-- For galleries handed over before the client has paid: every photo is served
-- with the studio's name burned into the pixels, so the gallery is reviewable
-- but not usable.
--
-- `watermark_text` is an optional override. When null the studio name is used
-- (organizers.credit_display_name, then business_name, then name), so turning
-- the toggle on is a single click for the common case.

ALTER TABLE events ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS watermark_text    VARCHAR(60);

COMMENT ON COLUMN events.watermark_enabled IS
  'When true, photos are composited server-side and no presigned R2 URL is ever handed to the browser. See lib/images/watermark.ts.';
COMMENT ON COLUMN events.watermark_text IS
  'Optional override for the watermark wording. Null means fall back to the studio name.';
