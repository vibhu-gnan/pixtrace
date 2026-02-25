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
  const dim = embeddings[0].length;
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

  return (data || []) as RawFaceResult[];
}

/**
 * 3-Iteration Refinement Face Search Algorithm
 *
 * Adapted from the prototype in refined_search_v2.py.
 * Uses pgvector RPC calls instead of FAISS.
 *
 * Steps:
 * 1. Initial search with selfie embedding → collect Tier 1 (score >= 0.40)
 * 2. Build prototype from Tier 1 embeddings, re-search, expand Tier 1 (up to 3 cycles)
 * 3. Final wide search with prototype → collect Tier 2 (score >= 0.29)
 * 4. Deduplicate by media_id (keep highest score per photo)
 */
export async function runFaceSearch(
  supabase: SupabaseClient,
  selfieEmbedding: number[],
  eventId: string,
): Promise<{ tier1: FaceMatch[]; tier2: FaceMatch[] }> {
  const {
    TIER_1_THRESHOLD,
    TIER_2_THRESHOLD,
    REFINEMENT_CYCLES,
    MAX_CANDIDATES,
  } = FACE_SEARCH;

  // --- Step A: Initial search with selfie embedding ---
  const initialResults = await searchFaces(
    supabase,
    selfieEmbedding,
    eventId,
    TIER_2_THRESHOLD, // Get all candidates above Tier 2 threshold
    MAX_CANDIDATES,
  );

  // Collect Tier 1 faces
  const tier1FaceIds = new Set<string>();
  const tier1Embeddings: number[][] = [];
  const allScores = new Map<string, { mediaId: string; score: number }>(); // face_id → best score

  for (const face of initialResults) {
    allScores.set(face.face_id, { mediaId: face.media_id, score: face.combined_score });
    if (face.combined_score >= TIER_1_THRESHOLD) {
      tier1FaceIds.add(face.face_id);
      tier1Embeddings.push(face.embedding);
    }
  }

  // --- Step B: Iterative prototype refinement ---
  let currentProto = selfieEmbedding;

  if (tier1Embeddings.length > 0) {
    for (let cycle = 0; cycle < REFINEMENT_CYCLES; cycle++) {
      // Build prototype from current Tier 1
      currentProto = buildPrototype(tier1Embeddings);

      // Re-search with prototype
      const protoResults = await searchFaces(
        supabase,
        currentProto,
        eventId,
        TIER_2_THRESHOLD,
        MAX_CANDIDATES,
      );

      let added = 0;
      for (const face of protoResults) {
        // Update best score
        const existing = allScores.get(face.face_id);
        if (!existing || face.combined_score > existing.score) {
          allScores.set(face.face_id, { mediaId: face.media_id, score: face.combined_score });
        }

        // Expand Tier 1
        if (!tier1FaceIds.has(face.face_id) && face.combined_score >= TIER_1_THRESHOLD) {
          tier1FaceIds.add(face.face_id);
          tier1Embeddings.push(face.embedding);
          added++;
        }
      }

      if (added === 0) break; // Converged — no new high-confidence faces
    }
  }

  // --- Step C: Final wide search with best prototype ---
  if (currentProto !== selfieEmbedding) {
    const finalResults = await searchFaces(
      supabase,
      currentProto,
      eventId,
      TIER_2_THRESHOLD,
      MAX_CANDIDATES,
    );

    for (const face of finalResults) {
      const existing = allScores.get(face.face_id);
      if (!existing || face.combined_score > existing.score) {
        allScores.set(face.face_id, { mediaId: face.media_id, score: face.combined_score });
      }
    }
  }

  // --- Step D: Deduplicate by media_id (keep highest score per photo) ---
  const mediaScores = new Map<string, { score: number; isTier1: boolean }>();

  for (const [faceId, { mediaId, score }] of allScores) {
    const isTier1 = tier1FaceIds.has(faceId);
    const existing = mediaScores.get(mediaId);
    if (!existing || score > existing.score) {
      mediaScores.set(mediaId, { score, isTier1: isTier1 || (existing?.isTier1 ?? false) });
    }
  }

  // Split into tier1 and tier2
  const tier1: FaceMatch[] = [];
  const tier2: FaceMatch[] = [];

  for (const [mediaId, { score, isTier1 }] of mediaScores) {
    if (isTier1) {
      tier1.push({ mediaId, score, tier: 1 });
    } else {
      tier2.push({ mediaId, score, tier: 2 });
    }
  }

  // Sort by score descending
  tier1.sort((a, b) => b.score - a.score);
  tier2.sort((a, b) => b.score - a.score);

  return { tier1, tier2 };
}
