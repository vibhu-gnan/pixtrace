-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add face_embedding vector column to media table
-- This is done separately because drizzle-orm doesn't fully support pgvector yet
ALTER TABLE media ADD COLUMN IF NOT EXISTS face_embedding vector(512);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS media_face_embedding_idx
ON media USING hnsw (face_embedding vector_cosine_ops);
