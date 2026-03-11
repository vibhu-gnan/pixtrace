-- ============================================================
-- PIXTRACE DEV DATABASE - Consolidated Schema Setup
-- Run this in the dev Supabase project SQL Editor
-- Generated from all production migrations
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Enums
CREATE TYPE "public"."media_type" AS ENUM('image', 'video');
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');
CREATE TYPE "public"."cover_type" AS ENUM('first', 'single', 'upload', 'slideshow');

-- 2. Core tables

CREATE TABLE organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
  razorpay_customer_id VARCHAR(255),
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_hash VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMP,
  cover_media_id UUID,
  cover_type cover_type DEFAULT 'first' NOT NULL,
  cover_r2_key TEXT,
  cover_slideshow_config JSONB,
  theme JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT true NOT NULL,
  face_search_enabled BOOLEAN NOT NULL DEFAULT false,
  show_face_scores BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE media (
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
  preview_r2_key TEXT,
  processing_status processing_status DEFAULT 'pending' NOT NULL,
  processing_error TEXT,
  face_count INTEGER DEFAULT NULL,
  captured_at TIMESTAMP,
  uploaded_at TIMESTAMP DEFAULT now() NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

-- 3. Subscription system tables

CREATE TABLE plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  storage_limit_bytes BIGINT NOT NULL DEFAULT 0,
  max_events INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  razorpay_plan_id VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

INSERT INTO plans (id, name, description, price_monthly, storage_limit_bytes, max_events, features, feature_flags, sort_order) VALUES
  ('free', 'Free', 'Get started with basic gallery hosting.', 0, 1073741824, 1,
   '["1 GB Storage", "1 Event", "Basic Analytics", "Email Support"]'::jsonb,
   '{"analytics": "basic", "watermarking": "standard", "downloads": false, "custom_branding": false, "client_proofing": false}'::jsonb,
   0),
  ('starter', 'Starter', 'Perfect for photographers just getting started with online galleries.', 249900, 10737418240, 5,
   '["10 GB Storage", "Up to 5 Events", "Original Quality Downloads", "Basic Analytics", "Email Support"]'::jsonb,
   '{"analytics": "basic", "watermarking": "standard", "downloads": true, "custom_branding": false, "client_proofing": false}'::jsonb,
   1),
  ('pro', 'Pro', 'For busy professionals handling multiple clients and high volumes.', 499900, 53687091200, 0,
   '["50 GB Storage", "Unlimited Events", "Custom Branding & Domain", "Client Proofing", "Priority Support", "Custom Watermarking"]'::jsonb,
   '{"analytics": "advanced", "watermarking": "custom", "downloads": true, "custom_branding": true, "client_proofing": true}'::jsonb,
   2),
  ('enterprise', 'Enterprise', 'Custom solutions for agencies and large scale studios.', 0, 0, 0,
   '["Unlimited Storage", "White-label Solution", "Dedicated Account Manager", "API Access", "Custom Everything"]'::jsonb,
   '{"analytics": "advanced", "watermarking": "custom", "downloads": true, "custom_branding": true, "client_proofing": true, "api_access": true, "white_label": true}'::jsonb,
   3)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
  razorpay_subscription_id VARCHAR(255) UNIQUE,
  razorpay_payment_id VARCHAR(255),
  razorpay_signature VARCHAR(512),
  status VARCHAR(50) NOT NULL DEFAULT 'created',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  grace_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  razorpay_payment_id VARCHAR(255) UNIQUE,
  razorpay_order_id VARCHAR(255),
  razorpay_invoice_id VARCHAR(255),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(50) NOT NULL,
  method VARCHAR(50),
  description TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE enterprise_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  organization VARCHAR(255),
  category VARCHAR(100),
  events_per_month INTEGER,
  photos_per_event INTEGER,
  additional_needs TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Face search tables

CREATE TABLE face_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  face_index SMALLINT NOT NULL DEFAULT 0,
  embedding vector(512) NOT NULL,
  confidence REAL,
  bbox_x1 INTEGER,
  bbox_y1 INTEGER,
  bbox_x2 INTEGER,
  bbox_y2 INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE face_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'no_faces')),
  attempt_count SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 3,
  faces_found SMALLINT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Gallery users + face profiles

CREATE TABLE gallery_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE face_search_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_user_id UUID NOT NULL REFERENCES gallery_users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prototype_embedding vector(512) NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(gallery_user_id, event_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Core indexes
CREATE INDEX albums_event_id_idx ON albums USING btree (event_id);
CREATE INDEX albums_sort_order_idx ON albums USING btree (sort_order);
CREATE INDEX events_event_hash_idx ON events USING btree (event_hash);
CREATE INDEX events_organizer_id_idx ON events USING btree (organizer_id);
CREATE INDEX events_created_at_idx ON events USING btree (created_at);
CREATE INDEX media_album_id_idx ON media USING btree (album_id);
CREATE INDEX media_event_id_idx ON media USING btree (event_id);
CREATE INDEX media_r2_key_idx ON media USING btree (r2_key);
CREATE INDEX media_processing_status_idx ON media USING btree (processing_status);
CREATE INDEX media_captured_at_idx ON media USING btree (captured_at);
CREATE INDEX media_uploaded_at_idx ON media USING btree (uploaded_at);
CREATE INDEX organizers_auth_id_idx ON organizers USING btree (auth_id);
CREATE INDEX organizers_email_idx ON organizers USING btree (email);
CREATE INDEX organizers_plan_id_idx ON organizers USING btree (plan_id);
CREATE INDEX organizers_razorpay_customer_id_idx ON organizers USING btree (razorpay_customer_id);

-- Subscription indexes
CREATE INDEX subscriptions_organizer_id_idx ON subscriptions USING btree (organizer_id);
CREATE INDEX subscriptions_razorpay_sub_id_idx ON subscriptions USING btree (razorpay_subscription_id);
CREATE INDEX subscriptions_status_idx ON subscriptions USING btree (status);
CREATE INDEX payment_history_organizer_id_idx ON payment_history USING btree (organizer_id);
CREATE INDEX payment_history_subscription_id_idx ON payment_history USING btree (subscription_id);
CREATE INDEX enterprise_inquiries_status_idx ON enterprise_inquiries USING btree (status);
CREATE INDEX enterprise_inquiries_email_idx ON enterprise_inquiries USING btree (email);

-- Face search indexes
CREATE INDEX face_embeddings_media_id_idx ON face_embeddings(media_id);
CREATE INDEX face_embeddings_event_id_idx ON face_embeddings(event_id);
CREATE INDEX face_embeddings_vector_idx ON face_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);
CREATE UNIQUE INDEX fpj_media_unique ON face_processing_jobs(media_id);
CREATE INDEX fpj_status_retry_idx ON face_processing_jobs(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX fpj_event_id_idx ON face_processing_jobs(event_id);

-- Gallery user indexes
CREATE INDEX gallery_users_auth_id_idx ON gallery_users(auth_id);
CREATE INDEX fsp_gallery_user_id_idx ON face_search_profiles(gallery_user_id);
CREATE INDEX fsp_event_id_idx ON face_search_profiles(event_id);

-- RLS performance indexes
CREATE INDEX idx_events_public_hash ON events(event_hash) WHERE is_public = true;
CREATE INDEX idx_organizers_auth_lookup ON organizers(auth_id, id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Organizers
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON organizers FOR SELECT USING (auth.uid()::text = auth_id);
CREATE POLICY "Users can update own profile" ON organizers FOR UPDATE USING (auth.uid()::text = auth_id);
CREATE POLICY "Users can insert own profile" ON organizers FOR INSERT WITH CHECK (auth.uid()::text = auth_id);

-- Events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers have full access to their events" ON events FOR ALL
  USING (organizer_id IN (SELECT id FROM organizers WHERE auth_id = auth.uid()::text));
CREATE POLICY "Public can view events by event_hash" ON events FOR SELECT USING (is_public = true);

-- Albums
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers have full access to their albums" ON albums FOR ALL
  USING (event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM organizers WHERE auth_id = auth.uid()::text)));
CREATE POLICY "Public can view albums for public events" ON albums FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE is_public = true));

-- Media
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers have full access to their media" ON media FOR ALL
  USING (event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM organizers WHERE auth_id = auth.uid()::text)));
CREATE POLICY "Public can view media for public events" ON media FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE is_public = true));

-- Plans
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable" ON plans FOR SELECT USING (true);

-- Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers can view own subscriptions" ON subscriptions FOR SELECT
  USING (organizer_id IN (SELECT id FROM organizers WHERE auth_id = auth.uid()::text));

-- Payment history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organizers can view own payments" ON payment_history FOR SELECT
  USING (organizer_id IN (SELECT id FROM organizers WHERE auth_id = auth.uid()::text));

-- Enterprise inquiries
ALTER TABLE enterprise_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit inquiry" ON enterprise_inquiries FOR INSERT WITH CHECK (true);

-- Face embeddings
ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read face embeddings for public events" ON face_embeddings FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE is_public = true));

-- Face processing jobs
ALTER TABLE face_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Gallery users
ALTER TABLE gallery_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own gallery_user row" ON gallery_users FOR SELECT USING (auth_id = auth.uid()::text);
CREATE POLICY "Users can insert own gallery_user row" ON gallery_users FOR INSERT WITH CHECK (auth_id = auth.uid()::text);
CREATE POLICY "Users can update own gallery_user row" ON gallery_users FOR UPDATE USING (auth_id = auth.uid()::text);

-- Face search profiles
ALTER TABLE face_search_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own face profiles" ON face_search_profiles FOR SELECT
  USING (gallery_user_id IN (SELECT id FROM gallery_users WHERE auth_id = auth.uid()::text));
CREATE POLICY "Users can insert own face profiles" ON face_search_profiles FOR INSERT
  WITH CHECK (gallery_user_id IN (SELECT id FROM gallery_users WHERE auth_id = auth.uid()::text));
CREATE POLICY "Users can update own face profiles" ON face_search_profiles FOR UPDATE
  USING (gallery_user_id IN (SELECT id FROM gallery_users WHERE auth_id = auth.uid()::text));

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Storage increment
CREATE OR REPLACE FUNCTION increment_storage_used(org_id UUID, bytes_to_add BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE organizers
  SET storage_used_bytes = GREATEST(0, COALESCE(storage_used_bytes, 0) + bytes_to_add),
      updated_at = now()
  WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Face search (full)
CREATE OR REPLACE FUNCTION search_face_embeddings(
  query_embedding vector(512),
  target_event_id UUID,
  similarity_threshold REAL DEFAULT 0.29,
  max_results INTEGER DEFAULT 200
)
RETURNS TABLE (
  face_id UUID,
  media_id UUID,
  face_index SMALLINT,
  embedding vector(512),
  cosine_similarity REAL,
  l2_distance REAL,
  combined_score REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fe.id AS face_id, fe.media_id, fe.face_index, fe.embedding,
    (1 - (fe.embedding <=> query_embedding))::REAL AS cosine_similarity,
    (fe.embedding <-> query_embedding)::REAL AS l2_distance,
    (0.80 * (1 - (fe.embedding <=> query_embedding)) +
     0.20 * exp(-0.5 * (fe.embedding <-> query_embedding)::float8))::REAL AS combined_score
  FROM face_embeddings fe
  WHERE fe.event_id = target_event_id
    AND (1 - (fe.embedding <=> query_embedding))::REAL >= similarity_threshold
  ORDER BY fe.embedding <=> query_embedding ASC
  LIMIT max_results;
$$;

-- Face search (lite - no embedding column returned)
CREATE OR REPLACE FUNCTION search_face_embeddings_lite(
  query_embedding vector(512),
  target_event_id UUID,
  similarity_threshold REAL DEFAULT 0.29,
  max_results INTEGER DEFAULT 200
)
RETURNS TABLE (
  face_id UUID,
  media_id UUID,
  face_index SMALLINT,
  cosine_similarity REAL,
  l2_distance REAL,
  combined_score REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fe.id AS face_id, fe.media_id, fe.face_index,
    (1 - (fe.embedding <=> query_embedding))::REAL AS cosine_similarity,
    (fe.embedding <-> query_embedding)::REAL AS l2_distance,
    (0.80 * (1 - (fe.embedding <=> query_embedding)) +
     0.20 * exp(-0.5 * (fe.embedding <-> query_embedding)::float8))::REAL AS combined_score
  FROM face_embeddings fe
  WHERE fe.event_id = target_event_id
    AND (1 - (fe.embedding <=> query_embedding))::REAL >= similarity_threshold
  ORDER BY fe.embedding <=> query_embedding ASC
  LIMIT max_results;
$$;

-- Claim face processing jobs
CREATE OR REPLACE FUNCTION claim_face_processing_jobs(
  max_jobs INTEGER DEFAULT 50,
  stuck_timeout_minutes INTEGER DEFAULT 10
)
RETURNS SETOF face_processing_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE face_processing_jobs
  SET status = 'pending', started_at = NULL, updated_at = now()
  WHERE status = 'processing'
    AND started_at < now() - (stuck_timeout_minutes || ' minutes')::interval;

  RETURN QUERY
  UPDATE face_processing_jobs
  SET status = 'processing', started_at = now(), attempt_count = attempt_count + 1, updated_at = now()
  WHERE id IN (
    SELECT id FROM face_processing_jobs
    WHERE status IN ('pending', 'failed')
      AND attempt_count < max_attempts
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at ASC
    LIMIT max_jobs
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
