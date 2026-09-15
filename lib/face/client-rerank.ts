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
const NEG_MARGIN = 0.02;     // how much closer to a rejected face before we auto-reject
// Two faces at or above this are treated as the same person. Deliberately the same bar
// used to call a match "definitely you": if it is strict enough to add a photo to Mine
// unreviewed, it is strict enough to say a face belongs to someone already rejected.
const SAME_PERSON_THRESHOLD = 0.666;

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
  pinnedFace?: Map<string, number>,
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
  // A face the user decided on is pinned — in a group shot the guess could otherwise
  // land on the look-alike standing next to them, which is what they just ruled on.
  const picked = entries.map((e) => {
    const pinned = pinnedFace?.get(e.id);
    if (pinned !== undefined && e.faces[pinned]) return e.faces[pinned];
    return pickBestFace(e.faces, anchor as number[]);
  });
  const weights = entries.map((e) => e.score);
  return buildPrototype(picked, weights);
}

/**
 * True when this media's matched face is the *same person* as one the user rejected,
 * judged at the same bar used to call something a confident match. Confident matches
 * are never shown for review, so without this a look-alike who scores above the
 * threshold lands in "Mine" permanently no matter how often they are rejected.
 */
function isRejectedPerson(
  faces: number[][],
  proto: number[],
  negatives: number[][],
  threshold: number,
): boolean {
  const face = l2normalize(pickBestFace(faces, proto));
  return negatives.some((negative) => combinedScore(face, negative) >= threshold);
}

/**
 * True when this media's most "you"-like face still resembles a face the user explicitly
 * rejected more than it resembles the prototype. At a large event the false positives are
 * a handful of genuinely similar-looking strangers, and one "Not me" identifies them by
 * name — far sharper evidence than any absolute score cutoff.
 */
function looksLikeRejected(
  faces: number[][],
  proto: number[],
  negatives: number[][],
): boolean {
  const face = l2normalize(pickBestFace(faces, proto));
  const positive = combinedScore(face, proto);

  let nearestNegative = -1;
  for (const negative of negatives) {
    const s = combinedScore(face, negative);
    if (s > nearestNegative) nearestNegative = s;
  }

  return nearestNegative > positive + NEG_MARGIN;
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
  matchedFace: Map<string, number>;  // media -> index of the face a decision is about
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
    return { kept, dropped, autoKeptCount: 0, autoDroppedCount: 0, matchedFace: new Map() };
  }

  const scoreById = new Map<string, number>();
  const confidentIds: string[] = [];
  const reviewBand: FaceSearchResult[] = [];
  for (const r of results) {
    scoreById.set(r.media_id, r.score);
    if (r.score >= finalThreshold) confidentIds.push(r.media_id);
    else reviewBand.push(r);
  }

  // Which face each decision is about: the one the algorithm matched, judged against a
  // prototype built from the confident set alone so it stays stable while the user works
  // through the queue — and so it names the same face the review UI showed them.
  const seedProto = refinedPrototype(confidentIds, scoreById, embMap);
  const matchedFace = new Map<string, number>();
  if (seedProto) {
    for (const r of results) {
      const faces = embMap[r.media_id];
      if (!faces || faces.length === 0) continue;
      let bestIndex = 0;
      let best = -1;
      for (let i = 0; i < faces.length; i++) {
        const s = combinedScore(l2normalize(faces[i]), seedProto);
        if (s > best) { best = s; bestIndex = i; }
      }
      matchedFace.set(r.media_id, bestIndex);
    }
  }

  // Only *explicit* rejections count as negatives — the algorithm's own auto-drops would
  // let one bad guess reinforce itself on every later pass. And only the face that was
  // actually shown: "not me" rules out that person, not everyone else in the photo, who
  // may well include the user themselves standing in the background.
  const negativeFaces: number[][] = [];
  for (const mediaId of userDropped) {
    const faces = embMap[mediaId];
    const index = matchedFace.get(mediaId);
    const face = faces && index !== undefined ? faces[index] : undefined;
    if (face) negativeFaces.push(l2normalize(face));
  }

  let autoKeptCount = 0;
  let autoDroppedCount = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    // Positives = confident matches + everything currently kept (user or auto), minus any
    // evicted below: a look-alike left in here drags the prototype toward them.
    const positiveIds = [...confidentIds.filter((id) => !dropped.has(id)), ...kept];
    const proto = refinedPrototype(positiveIds, scoreById, embMap, matchedFace);
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
      } else if (
        (positiveCount >= MIN_POS_FOR_DROP && s < AUTO_DROP) ||
        (negativeFaces.length > 0 && (
          // A look-alike is here *because* they resemble the user, so their score
          // against the prototype cancels their score against the rejected face and
          // the relative test never fires. Ask the absolute question too.
          isRejectedPerson(faces, proto, negativeFaces, SAME_PERSON_THRESHOLD) ||
          looksLikeRejected(faces, proto, negativeFaces)
        ))
      ) {
        dropped.add(r.media_id);
        autoDroppedCount++;
        changed = true;
      }
    }

    // Confident matches skip review entirely, so rejections are the only signal that one
    // of them is actually the look-alike standing next to the user all night.
    if (negativeFaces.length > 0) {
      for (const mediaId of confidentIds) {
        if (dropped.has(mediaId) || userKept.has(mediaId)) continue;
        const faces = embMap[mediaId];
        if (!faces || faces.length === 0) continue;
        if (isRejectedPerson(faces, proto, negativeFaces, finalThreshold)) {
          dropped.add(mediaId);
          autoDroppedCount++;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return { kept, dropped, autoKeptCount, autoDroppedCount, matchedFace };
}

export interface CandidateCluster {
  id: string;                    // representative media_id
  members: FaceSearchResult[];   // score descending
  representative: FaceSearchResult;
  topScore: number;
}

/**
 * The member whose face is most typical of the group, so the card shows a view the
 * user can actually recognise. Deliberately not the highest-scoring member: for a
 * stranger's cluster that is the single frame most confusable with the user, which is
 * the hardest one to judge. Ties break toward the larger crop.
 */
function pickMedoid(
  members: FaceSearchResult[],
  faceOf: Map<string, number[]>,
  faceAreas?: Record<string, number>,
): FaceSearchResult {
  if (members.length === 1) return members[0];

  let best = members[0];
  let bestRank = -Infinity;
  for (const candidate of members) {
    const face = faceOf.get(candidate.media_id);
    if (!face) continue;

    let total = 0;
    let counted = 0;
    for (const other of members) {
      if (other.media_id === candidate.media_id) continue;
      const otherFace = faceOf.get(other.media_id);
      if (!otherFace) continue;
      total += combinedScore(face, otherFace);
      counted++;
    }

    const rank = (counted ? total / counted : 0) + (faceAreas?.[candidate.media_id] ?? 0) * 0.001;
    if (rank > bestRank) { bestRank = rank; best = candidate; }
  }
  return best;
}

/**
 * Group review candidates by identity so the user is asked about a person once instead
 * of once per photo — at this event each attendee recurs in dozens of photos, so a
 * queue of forty is really only a handful of decisions.
 *
 * Clusters on the *matched* face (the one the decision is already about, and the one
 * the card crops to). Clustering on a photo's best face would group a crowd shot by
 * whoever happens to stand next to the user.
 *
 * Complete-link — a photo joins only if it matches every existing member. Faces here
 * average ~34 neighbours above the threshold and chains reach half again as far as
 * direct matches, so single-link would quietly merge two similar people and discard
 * the user's own photos. Splitting one person across two cards is the cheaper mistake.
 */
export function clusterCandidates(
  candidates: FaceSearchResult[],
  embMap: EmbeddingMap | null,
  matchedFace: Map<string, number>,
  sameThreshold: number = SAME_PERSON_THRESHOLD,
  faceAreas?: Record<string, number>,
): CandidateCluster[] {
  const asSingleton = (c: FaceSearchResult): CandidateCluster => ({
    id: c.media_id,
    members: [c],
    representative: c,
    topScore: c.score,
  });

  if (!embMap) return candidates.map(asSingleton);

  const faceOf = new Map<string, number[]>();
  for (const candidate of candidates) {
    const faces = embMap[candidate.media_id];
    if (!faces || faces.length === 0) continue;
    const index = matchedFace.get(candidate.media_id);
    const face = index !== undefined ? faces[index] : faces[0];
    if (face) faceOf.set(candidate.media_id, l2normalize(face));
  }

  const groups: FaceSearchResult[][] = [];
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    const face = faceOf.get(candidate.media_id);
    if (!face) { groups.push([candidate]); continue; } // no embedding → judged alone

    const home = groups.find((group) => group.every((member) => {
      const memberFace = faceOf.get(member.media_id);
      return memberFace ? combinedScore(face, memberFace) >= sameThreshold : false;
    }));

    if (home) home.push(candidate);
    else groups.push([candidate]);
  }

  return groups
    .map((members) => {
      const representative = pickMedoid(members, faceOf, faceAreas);
      return { id: representative.media_id, members, representative, topScore: members[0].score };
    })
    .sort((a, b) => b.topScore - a.topScore);
}
