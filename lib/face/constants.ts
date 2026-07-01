/**
 * Face search configuration — matches the proven prototype values.
 *
 * NOTE: the live selfie-search algorithm runs in the Python worker
 * (worker/face_worker.py `run_face_search`), which is the source of truth. It now
 * uses the Streamlit Mode A "softmax" sweep-best config: a softmax-weighted
 * prototype (PROTO_TAU=1.0) with a 0.50 seed/refinement threshold over 3 cycles.
 * The TIER_*_THRESHOLD values below drive the TS recall path (lib/face/recall-search.ts),
 * which re-searches a *saved* prototype and keeps the looser 0.44 display floor.
 */
export const FACE_SEARCH = {
  /** InsightFace w600k_r50 embedding dimension */
  EMBEDDING_DIM: 512,
  /** Cosine similarity weight in combined score */
  W_COSINE: 0.80,
  /** L2 distance weight in combined score */
  W_L2: 0.20,
  /** Exponential decay factor for L2 term */
  GAMMA: 0.5,
  /** Tier 1 threshold — high confidence, used for prototype building (matches face_engine.py) */
  TIER_1_THRESHOLD: 0.44,
  /** Tier 2 threshold — matches scored against refined prototype (matches face_engine.py) */
  TIER_2_THRESHOLD: 0.50,
  /** Display threshold — minimum combined score to show a photo in gallery results */
  DISPLAY_THRESHOLD: 0.33,
  /** Maximum refinement cycles for prototype iteration */
  REFINEMENT_CYCLES: 3,
  /** Max candidates to retrieve from pgvector per query */
  MAX_CANDIDATES: 200,
  /** Max images per batch sent to GPU server */
  MAX_BATCH_SIZE: 50,
  /** Max retry attempts for failed processing jobs */
  MAX_JOB_ATTEMPTS: 3,
  /** Base delay (seconds) for exponential backoff */
  RETRY_BASE_DELAY_S: 30,
  /** Jobs stuck in 'processing' longer than this are considered crashed */
  STUCK_JOB_TIMEOUT_MINUTES: 10,
  /** Minimum face detection confidence to accept a selfie */
  MIN_SELFIE_CONFIDENCE: 0.5,
  /** Max selfie file size (5MB) */
  MAX_SELFIE_SIZE: 5 * 1024 * 1024,
} as const;
