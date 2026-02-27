import { SupabaseClient } from '@supabase/supabase-js';
import { FACE_SEARCH } from './constants';

export interface RecallMatch {
  mediaId: string;
  score: number;
  tier: 1 | 2;
}

/**
 * Single-pass search using a pre-refined prototype embedding.
 * No iterative refinement needed — the prototype was already refined
 * during the original search. ~3x faster than runFaceSearch().
 */
export async function runRecallSearch(
  supabase: SupabaseClient,
  prototypeEmbedding: number[],
  eventId: string,
): Promise<{ tier1: RecallMatch[]; tier2: RecallMatch[] }> {
  const { TIER_1_THRESHOLD, TIER_2_THRESHOLD, MAX_CANDIDATES } = FACE_SEARCH;

  const pgVector = `[${prototypeEmbedding.join(',')}]`;

  const { data, error } = await supabase.rpc('search_face_embeddings', {
    query_embedding: pgVector,
    target_event_id: eventId,
    similarity_threshold: TIER_2_THRESHOLD,
    max_results: MAX_CANDIDATES,
  });

  if (error) {
    throw new Error(`Recall search failed: ${error.message}`);
  }

  // Deduplicate by media_id (keep highest score per photo)
  const mediaScores = new Map<string, { score: number; isTier1: boolean }>();

  for (const row of data || []) {
    const score = row.combined_score as number;
    const isTier1 = score >= TIER_1_THRESHOLD;
    const existing = mediaScores.get(row.media_id);
    if (!existing || score > existing.score) {
      mediaScores.set(row.media_id, {
        score,
        isTier1: isTier1 || (existing?.isTier1 ?? false),
      });
    }
  }

  const tier1: RecallMatch[] = [];
  const tier2: RecallMatch[] = [];

  for (const [mediaId, { score, isTier1 }] of mediaScores) {
    if (isTier1) {
      tier1.push({ mediaId, score, tier: 1 });
    } else {
      tier2.push({ mediaId, score, tier: 2 });
    }
  }

  tier1.sort((a, b) => b.score - a.score);
  tier2.sort((a, b) => b.score - a.score);

  return { tier1, tier2 };
}
