-- ============================================================================
-- PIXTRACE Database Setup Script
-- Run this entire script in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create enums
DO $$ BEGIN
  CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('image', 'video');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 3: Create tables
CREATE TABLE IF NOT EXISTS organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_hash VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMP,
  cover_media_id UUID,
  theme JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  original_filename VARCHAR(512) NOT NULL,
  media_type media_type NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  thumbnail_r2_key TEXT,
  face_embedding vector(512),
  processing_status processing_status NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  captured_at TIMESTAMP,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS organizers_auth_id_idx ON organizers(auth_id);
CREATE INDEX IF NOT EXISTS organizers_email_idx ON organizers(email);

CREATE INDEX IF NOT EXISTS events_event_hash_idx ON events(event_hash);
CREATE INDEX IF NOT EXISTS events_organizer_id_idx ON events(organizer_id);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at);

CREATE INDEX IF NOT EXISTS albums_event_id_idx ON albums(event_id);
CREATE INDEX IF NOT EXISTS albums_sort_order_idx ON albums(sort_order);

CREATE INDEX IF NOT EXISTS media_album_id_idx ON media(album_id);
CREATE INDEX IF NOT EXISTS media_event_id_idx ON media(event_id);
CREATE INDEX IF NOT EXISTS media_r2_key_idx ON media(r2_key);
CREATE INDEX IF NOT EXISTS media_processing_status_idx ON media(processing_status);
CREATE INDEX IF NOT EXISTS media_captured_at_idx ON media(captured_at);
CREATE INDEX IF NOT EXISTS media_uploaded_at_idx ON media(uploaded_at);

-- Vector similarity search index (HNSW for fast cosine distance)
CREATE INDEX IF NOT EXISTS media_face_embedding_idx ON media
USING hnsw (face_embedding vector_cosine_ops);

-- Performance indexes for RLS
CREATE INDEX IF NOT EXISTS idx_events_public_hash ON events(event_hash) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_organizers_auth_lookup ON organizers(auth_id, id);

-- ============================================================================
-- Step 5: Enable Row Level Security
-- ============================================================================

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

-- Organizers policies
CREATE POLICY "Users can view own profile"
  ON organizers FOR SELECT
  USING (auth.uid()::text = auth_id);

CREATE POLICY "Users can update own profile"
  ON organizers FOR UPDATE
  USING (auth.uid()::text = auth_id);

CREATE POLICY "Users can insert own profile"
  ON organizers FOR INSERT
  WITH CHECK (auth.uid()::text = auth_id);

-- Events policies
CREATE POLICY "Organizers have full access to their events"
  ON events FOR ALL
  USING (organizer_id IN (
    SELECT id FROM organizers WHERE auth_id = auth.uid()::text
  ));

CREATE POLICY "Public can view events by event_hash"
  ON events FOR SELECT
  USING (is_public = true);

-- Albums policies
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

-- Media policies
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
-- Step 6: Create AI webhook trigger (optional - for Phase 4)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_new_media()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_media',
    json_build_object(
      'media_id', NEW.id,
      'event_id', NEW.event_id,
      'r2_key', NEW.r2_key,
      'media_type', NEW.media_type
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_new_media ON media;
CREATE TRIGGER trigger_new_media
  AFTER INSERT ON media
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_media();

-- ============================================================================
-- Verification queries (run these to verify setup)
-- ============================================================================

-- Check if tables exist
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('organizers', 'events', 'albums', 'media')
ORDER BY table_name;

-- Check if pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('organizers', 'events', 'albums', 'media');

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ PIXTRACE database setup complete!';
  RAISE NOTICE 'Tables created: organizers, events, albums, media';
  RAISE NOTICE 'pgvector extension: enabled';
  RAISE NOTICE 'Row Level Security: enabled';
  RAISE NOTICE 'Indexes: created (including HNSW for face embeddings)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 You can now start the dev server: npm run dev';
END $$;
