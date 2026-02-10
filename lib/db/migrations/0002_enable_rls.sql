-- Enable Row Level Security on all tables
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON organizers;
DROP POLICY IF EXISTS "Users can update own profile" ON organizers;
DROP POLICY IF EXISTS "Users can insert own profile" ON organizers;
DROP POLICY IF EXISTS "Organizers have full access to their events" ON events;
DROP POLICY IF EXISTS "Public can view events by event_hash" ON events;
DROP POLICY IF EXISTS "Organizers have full access to their albums" ON albums;
DROP POLICY IF EXISTS "Public can view albums for public events" ON albums;
DROP POLICY IF EXISTS "Organizers have full access to their media" ON media;
DROP POLICY IF EXISTS "Public can view media for public events" ON media;

-- ============================================================================
-- ORGANIZERS POLICIES
-- ============================================================================

CREATE POLICY "Users can view own profile"
  ON organizers FOR SELECT
  USING (auth.uid()::text = auth_id);

CREATE POLICY "Users can update own profile"
  ON organizers FOR UPDATE
  USING (auth.uid()::text = auth_id);

CREATE POLICY "Users can insert own profile"
  ON organizers FOR INSERT
  WITH CHECK (auth.uid()::text = auth_id);

-- ============================================================================
-- EVENTS POLICIES
-- ============================================================================

CREATE POLICY "Organizers have full access to their events"
  ON events FOR ALL
  USING (organizer_id IN (
    SELECT id FROM organizers WHERE auth_id = auth.uid()::text
  ));

CREATE POLICY "Public can view events by event_hash"
  ON events FOR SELECT
  USING (is_public = true);

-- ============================================================================
-- ALBUMS POLICIES
-- ============================================================================

CREATE POLICY "Organizers have full access to their albums"
  ON albums FOR ALL
  USING (event_id IN (
    SELECT id FROM events WHERE organizer_id IN (
      SELECT id FROM organizers WHERE auth_id = auth.uid()::text
    )
  ));

CREATE POLICY "Public can view albums for public events"
  ON albums FOR SELECT
  USING (event_id IN (
    SELECT id FROM events WHERE is_public = true
  ));

-- ============================================================================
-- MEDIA POLICIES
-- ============================================================================

CREATE POLICY "Organizers have full access to their media"
  ON media FOR ALL
  USING (event_id IN (
    SELECT id FROM events WHERE organizer_id IN (
      SELECT id FROM organizers WHERE auth_id = auth.uid()::text
    )
  ));

CREATE POLICY "Public can view media for public events"
  ON media FOR SELECT
  USING (event_id IN (
    SELECT id FROM events WHERE is_public = true
  ));

-- ============================================================================
-- PERFORMANCE INDEXES FOR RLS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_events_public_hash ON events(event_hash) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_organizers_auth_lookup ON organizers(auth_id, id);
