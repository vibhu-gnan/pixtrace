-- ============================================================
-- Photographer credit
-- Organizer-level public profile shown in event galleries, so the
-- photographer gets marketing value from the galleries they already send.
-- ============================================================
--
-- These columns are read on PUBLIC gallery pages, but ONLY ever through
-- createAdminClient() with an explicit column whitelist (see
-- lib/credit/resolve-credit.ts).
--
-- Do NOT add an anon SELECT policy to `organizers` to make this "easier".
-- supabase-js column selection happens client-side, so any anon-readable
-- policy on this table exposes the whole row — email, phone, plan_id,
-- razorpay_customer_id, storage_used_bytes — to anyone holding the anon key.
-- The three existing policies are all auth.uid()-scoped and must stay that way.
--
-- Discrete columns rather than one JSONB blob, deliberately: the explicit
-- .select('credit_display_name, ...') IS the security boundary. With a blob,
-- any field added to it later would leak into a public payload silently.

ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_enabled      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_display_name VARCHAR(80);
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_tagline      VARCHAR(120);
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_logo_url     TEXT;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_whatsapp     VARCHAR(20);
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_instagram    VARCHAR(30);
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_website      TEXT;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS credit_public_email VARCHAR(255);

COMMENT ON COLUMN organizers.credit_enabled IS
  'Opt-in. Publishing contact details to every gallery guest is an explicit act, never inferred from the fields being filled in.';
COMMENT ON COLUMN organizers.credit_logo_url IS
  'R2 key only (branding/<organizerId>/<nanoid>.<ext>). External hosts are rejected so the story-card canvas can always load it through our proxy.';
COMMENT ON COLUMN organizers.credit_public_email IS
  'Business address shown to guests. Deliberately NOT defaulted from organizers.email — the login address must never be published by accident.';

-- Validation lives in lib/validation/contact.ts; these are the backstop for a
-- bug or a direct DB write, not the primary guard.
ALTER TABLE organizers DROP CONSTRAINT IF EXISTS organizers_credit_website_https;
ALTER TABLE organizers ADD  CONSTRAINT organizers_credit_website_https
  CHECK (credit_website IS NULL OR credit_website ~ '^https://[^\s]{1,200}$');

ALTER TABLE organizers DROP CONSTRAINT IF EXISTS organizers_credit_instagram_fmt;
ALTER TABLE organizers ADD  CONSTRAINT organizers_credit_instagram_fmt
  CHECK (credit_instagram IS NULL OR credit_instagram ~ '^[A-Za-z0-9._]{1,30}$');

ALTER TABLE organizers DROP CONSTRAINT IF EXISTS organizers_credit_whatsapp_fmt;
ALTER TABLE organizers ADD  CONSTRAINT organizers_credit_whatsapp_fmt
  CHECK (credit_whatsapp IS NULL OR credit_whatsapp ~ '^[0-9]{8,15}$');

ALTER TABLE organizers DROP CONSTRAINT IF EXISTS organizers_credit_logo_key;
ALTER TABLE organizers ADD  CONSTRAINT organizers_credit_logo_key
  CHECK (credit_logo_url IS NULL OR credit_logo_url ~ '^branding/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]{2,5}$');

-- ── Per-event click counts ──────────────────────────────────
--
-- A separate table, NOT a column on `events`. Verified against production:
-- `anon` holds a TABLE-LEVEL SELECT grant on events, and a table-level grant
-- automatically covers columns added later. The RLS policy on events
-- (USING (is_public = true)) is row-level and cannot restrict columns. So an
-- events.credit_clicks column would be readable by anyone at
--   /rest/v1/events?event_hash=eq.<hash>&select=credit_clicks
-- letting a rival studio read exactly how many enquiries a photographer gets
-- from each gallery.
--
-- If you are ever tempted to "simplify" this back onto events: that is the
-- bug. Leave it here.

CREATE TABLE IF NOT EXISTS credit_click_counts (
  event_id UUID   NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel  TEXT   NOT NULL CHECK (channel IN ('whatsapp','instagram','website','email','profile')),
  count    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, channel)
);

-- RLS on with no policies: service_role only, same shape as takedown_requests.
ALTER TABLE credit_click_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credit_click_counts FROM anon, authenticated;

/*
 * Called from /api/gallery/credit-click, which runs as service_role.
 *
 * The channel whitelist is repeated here even though the route also checks it:
 * the route check is convenience, this one is the boundary. Supabase's linter
 * shows five existing SECURITY DEFINER functions are callable by `anon`
 * directly at /rest/v1/rpc/<name>, which would make any route-level validation
 * decorative. We revoke below, and validate here in case that grant is ever
 * loosened.
 *
 * search_path is pinned — all ten pre-existing functions in this database run
 * with a mutable one, which lets a role with CREATE on an earlier schema
 * shadow a table the body resolves. Don't add an eleventh.
 */
CREATE OR REPLACE FUNCTION increment_credit_click(
    event_hash_input text,
    channel_input    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF channel_input NOT IN ('whatsapp','instagram','website','email','profile') THEN
        RETURN;
    END IF;

    INSERT INTO credit_click_counts (event_id, channel, count)
    SELECT e.id, channel_input, 1
      FROM events e
     WHERE e.event_hash = event_hash_input
       AND e.is_public = true          -- self-gate, so private galleries cannot be probed
    ON CONFLICT (event_id, channel)
    DO UPDATE SET count = credit_click_counts.count + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_credit_click(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION increment_credit_click(text, text) TO service_role;
