/**
 * Client-side active-learning re-rank for the face-search review queue.
 *
 * The worker returns each match's combined score but the raw face embeddings live in
 * `face_embeddings` (public-readable for public events). Once we have those embeddings
 * on the client we can, without any server round-trip:
 *   1. Seed a refined "you" prototype from the high-confidence matches (>= finalThreshold),
 *   2. re-score the lower-confidence review-band photos against it, and
 *   3. auto-resolve the obvious ones — promote clear matches into "Mine" and drop clear
 *      non-matches — so the human only reviews the genuinely ambiguous middle.
 * Every user "This is me" folds that face into the prototype and the pass repeats, so the
 * queue keeps shrinking as they go.
 *
 * The math mirrors `worker/face_worker.py` exactly (softmax-weighted, L2-normalized
 * prototype; combined score = 0.8*cos + 0.2*exp(-0.5*L2)) so scores stay in the same
 * space as the worker's and the 0.666 threshold means the same thing here.
 */
import type { FaceSearchResult } from './use-face-search';

/** One media -> its detected face embeddings (already L2-normalized by InsightFace). */
export type EmbeddingMap = Record<string, number[][]>;

const PROTO_TAU = 1.0;       // softmax temperature (matches worker PROTO_TAU)
const AUTO_DROP = 0.38;      // refined score below this => auto-reject (below the 0.44 seed)
const MIN_POS_FOR_DROP = 2;  // require >=2 verified positives before we auto-reject anything
const MAX_PASSES = 5;        // snowball passes; auto-kept photos strengthen the prototype

// ── vector math ────────────────────────────────────────────────────────────
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function l2normalize(v: number[]): number[] {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n);
  if (n < 1e-10) return v.slice();
  return v.map((x) => x / n);
}

/** Combined similarity of two L2-normalized embeddings — identical to the worker/SQL. */
function combinedScore(a: number[], b: number[]): number {
  let cos = dot(a, b);
  if (cos > 1) cos = 1;
  else if (cos < -1) cos = -1;
  const l2 = Math.sqrt(Math.max(0, 2 - 2 * cos));
  return 0.8 * cos + 0.2 * Math.exp(-0.5 * l2);
}

/** Softmax(score/tau)-weighted mean of the given faces, L2-normalized. Mirrors build_prototype. */
function buildPrototype(faces: number[][], weights: number[]): number[] | null {
  if (faces.length === 0) return null;
  const dim = faces[0].length;
  const proto = new Array(dim).fill(0);
  if (faces.length === 1) return l2normalize(faces[0]);

  const tau = Math.max(PROTO_TAU, 1e-6);
  const scaled = weights.map((w) => w / tau);
  const max = Math.max(...scaled);
  const exp = scaled.map((s) => Math.exp(s - max));
  const sum = exp.reduce((a, b) => a + b, 0) || 1;
  const w = exp.map((e) => e / sum);

  for (let f = 0; f < faces.length; f++) {
    const face = faces[f];
    for (let i = 0; i < dim; i++) proto[i] += w[f] * face[i];
  }
  return l2normalize(proto);
}

/** Best (max) combined score of any of a media's faces against the prototype. */
function bestScore(faces: number[][] | undefined, proto: number[]): number {
  if (!faces || faces.length === 0) return 0;
  let best = -1;
  for (const face of faces) {
    const s = combinedScore(l2normalize(face), proto);
    if (s > best) best = s;
  }
  return best;
}

/** The single face of a media that best matches the prototype. */
function pickBestFace(faces: number[][], proto: number[]): number[] {
  let best = faces[0];
  let bestS = -1;
  for (const face of faces) {
    const s = combinedScore(l2normalize(face), proto);
    if (s > bestS) { bestS = s; best = face; }
  }
  return best;
}

/**
 * Build a prototype from a set of "positive" media (confident + confirmed).
 * Multi-face photos are disambiguated by picking each media's face most consistent
 * with the others (anchoring on single-face photos when available).
 */
function refinedPrototype(
  positiveIds: string[],
  scoreById: Map<string, number>,
  embMap: EmbeddingMap,
): number[] | null {
  const entries = positiveIds
    .map((id) => ({ id, faces: embMap[id] || [], score: scoreById.get(id) ?? 0.5 }))
    .filter((e) => e.faces.length > 0);
  if (entries.length === 0) return null;

  // Anchor: prefer unambiguous single-face positives; else the highest-scoring photo's
  // face that agrees most with the other positives (the recurring "you" face).
  const singles = entries.filter((e) => e.faces.length === 1);
  let anchor: number[] | null;
  if (singles.length > 0) {
    anchor = buildPrototype(singles.map((e) => e.faces[0]), singles.map((e) => e.score));
  } else {
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    const cand = sorted[0];
    const others = sorted.slice(1);
    let bestFace = cand.faces[0];
    let bestAgreement = -Infinity;
    for (const face of cand.faces) {
      const nf = l2normalize(face);
      let agree = 0;
      for (const o of others) agree += bestScore(o.faces, nf);
      if (agree > bestAgreement) { bestAgreement = agree; bestFace = face; }
    }
    anchor = l2normalize(bestFace);
  }
  if (!anchor) return null;

  // Refine: pick each positive media's best face vs the anchor, weight by its score.
  const picked = entries.map((e) => pickBestFace(e.faces, anchor as number[]));
  const weights = entries.map((e) => e.score);
  return buildPrototype(picked, weights);
}

export interface RecomputeInput {
  results: FaceSearchResult[];
  embMap: EmbeddingMap | null;
  userKept: Set<string>;      // media the user tapped "This is me"
  userDropped: Set<string>;   // media the user tapped "Not me"
  finalThreshold: number;     // FINAL_THRESHOLD (0.666)
}

export interface RecomputeResult {
  kept: Set<string>;      // review-band media that belong in "Mine" (user + auto)
  dropped: Set<string>;   // review-band media excluded from "Mine" (user + auto)
  autoKeptCount: number;  // how many the algorithm promoted on its own
  autoDroppedCount: number;
}

/**
 * Idempotent: given the user's explicit decisions, derive the full kept/dropped sets by
 * folding in the algorithm's auto-resolutions. Recomputed from scratch each call so there
 * are no accumulation bugs — safe to run after every user decision.
 */
export function recomputeDecisions({
  results,
  embMap,
  userKept,
  userDropped,
  finalThreshold,
}: RecomputeInput): RecomputeResult {
  const kept = new Set(userKept);
  const dropped = new Set(userDropped);

  // Nothing to re-rank with — fall back to pure manual review.
  if (!embMap) {
    return { kept, dropped, autoKeptCount: 0, autoDroppedCount: 0 };
  }

  const scoreById = new Map<string, number>();
  const confidentIds: string[] = [];
  const reviewBand: FaceSearchResult[] = [];
  for (const r of results) {
    scoreById.set(r.media_id, r.score);
    if (r.score >= finalThreshold) confidentIds.push(r.media_id);
    else reviewBand.push(r);
  }

  let autoKeptCount = 0;
  let autoDroppedCount = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // Positives = confident matches + everything currently kept (user or auto).
    const positiveIds = [...confidentIds, ...kept];
    const proto = refinedPrototype(positiveIds, scoreById, embMap);
    if (!proto) break; // no seed yet (no confident matches, no confirmations)

    const positiveCount = positiveIds.length;
    let changed = false;

    for (const r of reviewBand) {
      if (kept.has(r.media_id) || dropped.has(r.media_id)) continue;
      const faces = embMap[r.media_id];
      if (!faces || faces.length === 0) continue; // no embedding → leave for manual review
      const s = bestScore(faces, proto);
      if (s >= finalThreshold) {
        kept.add(r.media_id);
        autoKeptCount++;
        changed = true;
      } else if (positiveCount >= MIN_POS_FOR_DROP && s < AUTO_DROP) {
        dropped.add(r.media_id);
        autoDroppedCount++;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return { kept, dropped, autoKeptCount, autoDroppedCount };
}
