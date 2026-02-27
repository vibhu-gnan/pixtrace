-- ============================================================
-- Gallery Users + Face Search Profiles
-- Enables persistent face search for returning gallery visitors
-- ============================================================

-- 1. Gallery users table (lightweight, for gallery visitors)
CREATE TABLE IF NOT EXISTS gallery_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS gallery_users_auth_id_idx ON gallery_users(auth_id);

-- 2. Face search profiles (one refined prototype per user per event)
CREATE TABLE IF NOT EXISTS face_search_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_user_id UUID NOT NULL REFERENCES gallery_users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prototype_embedding vector(512) NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(gallery_user_id, event_id)
);

CREATE INDEX IF NOT EXISTS fsp_gallery_user_id_idx ON face_search_profiles(gallery_user_id);
CREATE INDEX IF NOT EXISTS fsp_event_id_idx ON face_search_profiles(event_id);

-- 3. RLS Policies

ALTER TABLE gallery_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_search_profiles ENABLE ROW LEVEL SECURITY;

-- Gallery users: users can read their own row
CREATE POLICY "Users can read own gallery_user row"
  ON gallery_users FOR SELECT
  USING (auth_id = auth.uid()::text);

-- Gallery users: users can insert their own row
CREATE POLICY "Users can insert own gallery_user row"
  ON gallery_users FOR INSERT
  WITH CHECK (auth_id = auth.uid()::text);

-- Gallery users: users can update their own row
CREATE POLICY "Users can update own gallery_user row"
  ON gallery_users FOR UPDATE
  USING (auth_id = auth.uid()::text);

-- Face search profiles: users can read their own profiles
CREATE POLICY "Users can read own face profiles"
  ON face_search_profiles FOR SELECT
  USING (gallery_user_id IN (
    SELECT id FROM gallery_users WHERE auth_id = auth.uid()::text
  ));

-- Face search profiles: users can insert their own profiles
CREATE POLICY "Users can insert own face profiles"
  ON face_search_profiles FOR INSERT
  WITH CHECK (gallery_user_id IN (
    SELECT id FROM gallery_users WHERE auth_id = auth.uid()::text
  ));

-- Face search profiles: users can update their own profiles (re-scan)
CREATE POLICY "Users can update own face profiles"
  ON face_search_profiles FOR UPDATE
  USING (gallery_user_id IN (
    SELECT id FROM gallery_users WHERE auth_id = auth.uid()::text
  ));
