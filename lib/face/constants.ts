/** Face search configuration — matches the proven prototype values */
export const FACE_SEARCH = {
  /** InsightFace w600k_r50 embedding dimension */
  EMBEDDING_DIM: 512,
  /** Cosine similarity weight in combined score */
  W_COSINE: 0.80,
  /** L2 distance weight in combined score */
  W_L2: 0.20,
  /** Exponential decay factor for L2 term */
  GAMMA: 0.5,
  /** Tier 1 threshold — high confidence, used for prototype building */
  TIER_1_THRESHOLD: 0.40,
  /** Tier 2 threshold — wider net for borderline matches */
  TIER_2_THRESHOLD: 0.29,
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
