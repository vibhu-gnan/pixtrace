-- ============================================================
-- Lite face search RPC — omits embedding column for recall search
-- Identical scoring/filtering to search_face_embeddings, but ~90% less data transfer
-- Used by recall-search.ts which never reads the embedding column
-- ============================================================

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
    fe.id AS face_id,
    fe.media_id,
    fe.face_index,
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
