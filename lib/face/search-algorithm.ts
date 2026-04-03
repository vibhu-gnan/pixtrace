import { SupabaseClient } from '@supabase/supabase-js';
import { FACE_SEARCH } from './constants';

export interface FaceMatch {
  mediaId: string;
  score: number;
  tier: 1 | 2;
}

interface RawFaceResult {
  face_id: string;
  media_id: string;
  face_index: number;
  embedding: number[];
  cosine_similarity: number;
  l2_distance: number;
  combined_score: number;
}

/**
 * L2-normalize a vector in-place.
 */
function l2Normalize(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1e-10;
  return vec.map(v => v / norm);
}

/**
 * Compute the mean of multiple vectors, then L2-normalize.
 */
function buildPrototype(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  const dim = embeddings[0].length;
  if (dim === 0) return [];
  const mean = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) mean[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= embeddings.length;
  return l2Normalize(mean);
}

/**
 * Format embedding array as pgvector string: [0.1,0.2,...]
 */
function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Parse a pgvector string "[0.1,0.2,...]" into a number[].
 * Supabase returns vector columns as strings, not arrays.
 */
function parseEmbedding(raw: unknown): number[] {
  if (Array.isArray(raw) && raw.every(x => typeof x === 'number')) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === 'number')) {
        return parsed;
      }
    } catch {
      console.error('[FaceSearch] Failed to parse embedding string');
    }
  }
  return [];
}

/**
 * Search face embeddings using the RPC function.
 * Returns raw results with embeddings for prototype building.
 */
async function searchFaces(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  eventId: string,
  threshold: number,
  maxResults: number,
): Promise<RawFaceResult[]> {
  const { data, error } = await supabase.rpc('search_face_embeddings', {
    query_embedding: toPgVector(queryEmbedding),
    target_event_id: eventId,
    similarity_threshold: threshold,
    max_results: maxResults,
  });

  if (error) {
    throw new Error(`pgvector search failed: ${error.message}`);
  }

  // Parse embedding from pgvector string to number[]
  return (data || []).map((row: any) => ({
    ...row,
    embedding: parseEmbedding(row.embedding),
  })) as RawFaceResult[];
}

/**
 * 3-Iteration Refinement Face Search Algorithm
 *
 * Matches face_engine.py search_gallery() logic exactly:
 * 1. Initial search with selfie embedding → collect Tier 1 (combined_score >= 0.44)
 * 2. Build prototype from Tier 1 embeddings, re-search, expand Tier 1 (up to 3 cycles)
 * 3. Final search with refined prototype → collect Tier 2 (combined_score >= 0.50, not in Tier 1)
 * 4. Deduplicate by media_id (keep highest score per photo)
 */
export async function runFaceSearch(
  supabase: SupabaseClient,
  selfieEmbedding: number[],
  eventId: string,
): Promise<{ tier1: FaceMatch[]; tier2: FaceMatch[]; prototype: number[] }> {
  const {
    TIER_1_THRESHOLD,
    TIER_2_THRESHOLD,
    REFINEMENT_CYCLES,
    MAX_CANDIDATES,
  } = FACE_SEARCH;

  // Use a low SQL-level pre-filter to fetch candidates; real filtering happens in JS
  const SQL_PREFILTER = 0.20;

  // --- Step A: Initial search with selfie embedding ---
  const initialResults = await searchFaces(
    supabase,
    selfieEmbedding,
    eventId,
    SQL_PREFILTER,
    MAX_CANDIDATES,
  );

  // Collect Tier 1 faces (combined_score >= TIER_1_THRESHOLD against selfie)
  const tier1FaceIds = new Set<string>();
  const tier1Embeddings: number[][] = [];

  // Track tier1 candidates with their initial scores
  const tier1Candidates: { faceId: string; mediaId: string; score: number }[] = [];

  for (const face of initialResults) {
    if (face.combined_score >= TIER_1_THRESHOLD) {
      tier1FaceIds.add(face.face_id);
      tier1Embeddings.push(face.embedding);
      tier1Candidates.push({
        faceId: face.face_id,
        mediaId: face.media_id,
        score: face.combined_score,
      });
    }
  }

  // --- Step B: Iterative prototype refinement ---
  // Mirrors face_engine.py: expand tier1 set using prototype re-scoring
  let currentProto = selfieEmbedding;

  if (tier1Embeddings.length > 0) {
    for (let cycle = 0; cycle < REFINEMENT_CYCLES; cycle++) {
      currentProto = buildPrototype(tier1Embeddings);

      const protoResults = await searchFaces(
        supabase,
        currentProto,
        eventId,
        SQL_PREFILTER,
        MAX_CANDIDATES,
      );

      let added = 0;
      for (const face of protoResults) {
        if (!tier1FaceIds.has(face.face_id) && face.combined_score >= TIER_1_THRESHOLD) {
          tier1FaceIds.add(face.face_id);
          tier1Embeddings.push(face.embedding);
          tier1Candidates.push({
            faceId: face.face_id,
            mediaId: face.media_id,
            score: face.combined_score,
          });
          added++;
        }
      }

      if (added === 0) break; // Converged
    }
  }

  // --- Step C: Final search with refined prototype → Tier 2 ---
  // Matches face_engine.py: tier2 = prototype matches >= TIER_2_THRESHOLD, NOT in tier1
  const tier2Candidates: { faceId: string; mediaId: string; score: number }[] = [];

  if (currentProto !== selfieEmbedding) {
    const finalResults = await searchFaces(
      supabase,
      currentProto,
      eventId,
      SQL_PREFILTER,
      MAX_CANDIDATES,
    );

    for (const face of finalResults) {
      if (!tier1FaceIds.has(face.face_id) && face.combined_score >= TIER_2_THRESHOLD) {
        tier2Candidates.push({
          faceId: face.face_id,
          mediaId: face.media_id,
          score: face.combined_score,
        });
      }
    }
  }

  // --- Step D: Deduplicate by media_id (keep highest score per photo) ---
  const tier1MediaScores = new Map<string, number>();
  for (const c of tier1Candidates) {
    const existing = tier1MediaScores.get(c.mediaId);
    if (!existing || c.score > existing) {
      tier1MediaScores.set(c.mediaId, c.score);
    }
  }

  const tier2MediaScores = new Map<string, number>();
  for (const c of tier2Candidates) {
    if (tier1MediaScores.has(c.mediaId)) continue; // Already in tier1
    const existing = tier2MediaScores.get(c.mediaId);
    if (!existing || c.score > existing) {
      tier2MediaScores.set(c.mediaId, c.score);
    }
  }

  const tier1: FaceMatch[] = [];
  for (const [mediaId, score] of tier1MediaScores) {
    tier1.push({ mediaId, score, tier: 1 });
  }

  const tier2: FaceMatch[] = [];
  for (const [mediaId, score] of tier2MediaScores) {
    tier2.push({ mediaId, score, tier: 2 });
  }

  tier1.sort((a, b) => b.score - a.score);
  tier2.sort((a, b) => b.score - a.score);

  return { tier1, tier2, prototype: currentProto };
}
