-- Add view_count column to albums table
ALTER TABLE albums ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- ─── Album view count: atomic increment by N ─────────────────────
-- Called from the batched /api/gallery/view route.
-- Only increments albums that belong to a public event (prevents gaming).
CREATE OR REPLACE FUNCTION increment_album_view_count(
    album_id_input uuid,
    amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clamp amount to [1, 10000] to prevent overflow attacks
    IF amount < 1 THEN amount := 1; END IF;
    IF amount > 10000 THEN amount := 10000; END IF;

    UPDATE albums a
    SET view_count = a.view_count + amount
    FROM events e
    WHERE a.id = album_id_input
      AND a.event_id = e.id
      AND e.is_public = true;
END;
$$;

-- ─── Event view count: atomic increment by N (replaces missing _by variant) ──
-- The existing route tries increment_view_count_by first; create it properly.
CREATE OR REPLACE FUNCTION increment_view_count_by(
    event_hash_input text,
    amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF amount < 1 THEN amount := 1; END IF;
    IF amount > 10000 THEN amount := 10000; END IF;

    UPDATE events
    SET view_count = view_count + amount
    WHERE event_hash = event_hash_input
      AND is_public = true;
END;
$$;
