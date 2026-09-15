-- Atomic JSONB merge for event theme updates.
-- Prevents race conditions when multiple theme keys are updated concurrently
-- (e.g., logo + hero edited at the same time).
--
-- Uses the || operator for shallow merge: each caller only touches its own
-- top-level key (hero, logoUrl, logoDisplay, photo_order, customPreloader),
-- so concurrent calls safely compose without overwriting each other.

CREATE OR REPLACE FUNCTION merge_event_theme(
  p_event_id uuid,
  p_organizer_id uuid,
  p_theme_patch jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE events
  SET
    theme = COALESCE(theme, '{}'::jsonb) || p_theme_patch,
    updated_at = now()
  WHERE id = p_event_id
    AND organizer_id = p_organizer_id;
$$;
