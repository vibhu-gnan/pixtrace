-- Add view_count column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Atomic increment function — called from API route
-- Only increments for public events (prevents gaming private events)
CREATE OR REPLACE FUNCTION increment_view_count(event_hash_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE events
    SET view_count = view_count + 1
    WHERE event_hash = event_hash_input
      AND is_public = true;
END;
$$;
