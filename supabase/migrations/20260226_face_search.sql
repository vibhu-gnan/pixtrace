-- ============================================================
-- PIXTRACE Face Search Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Face embeddings table (one row per detected face)
CREATE TABLE IF NOT EXISTS face_embeddings (
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

CREATE INDEX IF NOT EXISTS face_embeddings_media_id_idx ON face_embeddings(media_id);
CREATE INDEX IF NOT EXISTS face_embeddings_event_id_idx ON face_embeddings(event_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS face_embeddings_vector_idx ON face_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

-- 3. Face processing jobs table (queue for GPU processing)
CREATE TABLE IF NOT EXISTS face_processing_jobs (
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

-- One job per media item (prevents duplicate enqueuing)
CREATE UNIQUE INDEX IF NOT EXISTS fpj_media_unique ON face_processing_jobs(media_id);
CREATE INDEX IF NOT EXISTS fpj_status_retry_idx ON face_processing_jobs(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS fpj_event_id_idx ON face_processing_jobs(event_id);

-- 4. Add face_count column to media table
-- NULL = not yet processed, 0 = no faces, >0 = has faces
ALTER TABLE media ADD COLUMN IF NOT EXISTS face_count INTEGER DEFAULT NULL;

-- 4b. Add face_search_enabled toggle to events table (default OFF)
ALTER TABLE events ADD COLUMN IF NOT EXISTS face_search_enabled BOOLEAN NOT NULL DEFAULT false;

-- 5. RLS Policies

ALTER TABLE face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Public can read face embeddings for public events (needed for face search)
CREATE POLICY "Public read face embeddings for public events"
  ON face_embeddings FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE is_public = true));

-- Service role has full access (admin client bypasses RLS anyway,
-- but this ensures no accidental anon writes)

-- Processing jobs: service role only (no public access needed)
-- Default: no policy = no access for anon, service_role bypasses RLS

-- 6. RPC function for face similarity search
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
    fe.id AS face_id,
    fe.media_id,
    fe.face_index,
    fe.embedding,
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

-- 7. Helper: atomically claim pending jobs and increment attempt_count
CREATE OR REPLACE FUNCTION claim_face_processing_jobs(
  max_jobs INTEGER DEFAULT 50,
  stuck_timeout_minutes INTEGER DEFAULT 10
)
RETURNS SETOF face_processing_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  -- Unstick crashed jobs first
  UPDATE face_processing_jobs
  SET status = 'pending', started_at = NULL, updated_at = now()
  WHERE status = 'processing'
    AND started_at < now() - (stuck_timeout_minutes || ' minutes')::interval;

  -- Claim and return jobs atomically
  RETURN QUERY
  UPDATE face_processing_jobs
  SET status = 'processing',
      started_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now()
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
