# Face search tuning — known-good baseline

Verified on **EIS 4.0** (1,500 photos, 7,006 faces) on **2026-09-15**, tagged
`face-search-known-good-2026-09-15`. Roll back to that tag if a change to the
values below makes results worse.

This gallery is the stress case: it is more than 10x the size of the events the
original thresholds were tuned on (University 618 faces, Life 592, Family 423),
and its group shots carry 20–45 faces each. Anything tuned only on the small
events will look fine there and fall apart here.

## Why this needed tuning at all

False positives scale with the number of faces searched. A fixed threshold that
is generous on 600 faces is reckless on 7,000, because roughly ten times as many
strangers cross it by chance. Every symptom below came from that one fact.

## The values that matter

Search — `worker/face_worker.py`:

| Constant | Value | Why this value |
|---|---|---|
| `TIER_1_THRESHOLD` | 0.44 | Seed + what gets *returned*. Raising it starves recall — a real person once scored just under 0.50 and got zero results. |
| `PROTO_MIN_SCORE` | 0.55 | Only clear matches may *shape* the prototype. The binding constraint in practice. |
| `PROTO_MAX_FACES` | 40 | Ceiling so one cycle cannot flood the prototype. Rarely binds. |
| `PROTO_MIN_FACES` | 5 | Fallback when nothing clears 0.55, so an all-borderline selfie still gets a prototype. |
| `PROTO_TAU` | 1.0 | Softmax temperature. Note it barely separates scores — see below. |
| `MAX_CANDIDATES` | 200 | Always saturates, but harmlessly — rank 200 already scores ~0.32, well under the 0.44 bar. Raising it adds only rejects. |

Review re-rank — `lib/face/client-rerank.ts`:

| Constant | Value | Why this value |
|---|---|---|
| `FINAL_THRESHOLD` (in `gallery-page-client.tsx`) | 0.666 | At or above this a photo skips review and goes straight to "Mine". |
| `NEG_MARGIN` | 0.02 | How much closer to a rejected face before auto-rejecting. Negative values would drop photos that look *more* like the user than the rejected face. |
| `AUTO_DROP` | 0.38 | Absolute floor for auto-reject. |

## The central lesson: membership, not weighting

The prototype pool and the returned results used to be the same list, so every
face admitted for recall also got a vote in what the user's face looks like.

Softmax weighting cannot compensate for this. At `tau = 1.0`, a 0.44 face carries
**70%** the weight of a 0.80 face (`exp(0.36) = 1.43`), so a crowd of borderline
faces simply outvotes the real matches and the prototype converges on the average
attendee. Keep the two lists separate.

## What healthy refinement looks like

The worker logs one line per search. Read the growth pattern, not the totals:

```
refine: 3/3 cycle(s), seed 20 -> 77 faces, added [54, 2, 1], prototype from 19 faces, candidates 200/200
```

- `added [54, 2, 1]` — **healthy**. The prototype stabilised after cycle 1.
- `added [63, 118, 25]` — **drift**. A later cycle adding more than the first means
  the prototype is chasing itself into the crowd. This produced 109 results when a
  confirmed face of the user had only 46 neighbours above the seed bar.

Same selfie, same gallery, before and after separating the pools: 226 prototype
faces and 109 results became 77 and 50.

## Review queue: grouped by person

At ~35 photos per attendee, a review queue of forty photos is really a handful of
people. The queue is clustered by identity (`clusterCandidates` in
`lib/face/client-rerank.ts`) and the guest answers once per person.

Three choices that look arbitrary in the code and are not:

| Choice | Why |
|---|---|
| Cluster the **matched face**, not a photo's best face | The matched face is the one the card crops to. Clustering a photo's best face groups a crowd shot by whoever stands next to the guest, so the card and the grouping would judge different people. |
| **Complete-link** (must match *every* member), not single-link | Faces average ~34 neighbours at 0.666 and 2-hop reachability grows a cluster 1.6-1.8x (5→9, 2→3, 28→46). Single-link rides those chains and merges two similar people, which silently discards the guest's own photos. Splitting one person across two cards is the cheaper mistake. |
| Representative is the **medoid**, not the top scorer | The highest-scoring frame of a stranger is the one most confusable with the guest — the hardest to judge. The medoid is the most typical view. Ties break toward the larger crop. |

Risk is asymmetric: rejecting a wrong cluster is recoverable, but *confirming* one puts
a stranger into the prototype as a weighted positive and drifts it. Hence the card shows
a crop strip of the whole group — a bad grouping is visible before it is answered for.

Measured: 36 candidates → 20 cards, 50 → 30, with the worst repeat (8 photos of one
person) collapsing to a single decision. Deliberately conservative; the dial for more
grouping is average-link, not a lower threshold.

The review band also applies the **absolute** same-person test now, not only the
relative one. A look-alike scores high against the prototype precisely because they
resemble the guest, which cancels the relative margin and let the same face return over
and over.

## Scale-aware display floor

`display_floor(face_count)` in `worker/face_worker.py`. The floor stays at the tuned
`TIER_1_THRESHOLD` (0.44) up to `FLOOR_BASE_FACES` (600), then rises `FLOOR_STEP` (0.05)
per doubling, capped at `FLOOR_MAX` (0.55). EIS 4.0 (7,006 faces) lands at 0.55; every
smaller event stays at 0.44 unchanged.

It filters only the **final display list**. The seed, the prototype pool and the
refinement cycles all still run at 0.44, so this cannot repeat the starved-recall
incident that a flat 0.50 seed caused. `MIN_DISPLAY_RESULTS` (10) means the floor can
thin the list but never hand someone an empty gallery.

Measured on this gallery: confident matches (>= 0.666) are never cut, since the floor
sits below that bar — only the uncertain tail is trimmed. Review band 36 → 22, 50 → 34,
31 → 19. A search returning just 5 matches lost none, the guard holding as intended.

## Silent failure modes, all seen live

Each of these produced no error and no log line. Check them first when results
look wrong.

- **PostgREST truncates at 1,000 rows.** 109 matched photos is ~2,668 face rows
  here, so an unpaged query silently returned a third of them. The client re-ranker
  reads a missing embedding as "leave it to the human", so the review queue looked
  stubbornly long and face crops had nothing to crop to. Page every query that can
  exceed 1,000 rows.
- **Payload size decides perceived correctness.** Embeddings for one search are
  ~16MB and take ~9s; the face boxes are 0.2MB. They are fetched separately for
  this reason — bundled, the crop appears broken for nine seconds.
- **Paging without ORDER BY silently drops rows.** `.range(1000, 1999)` has no stable
  meaning on an unordered query, so page two can come back short, a `length < PAGE`
  loop reads that as the end of the data, and a third of the rows vanish — a
  *different* third each call. Measured live: the same request returned 1831 of 2668
  rows, and the media count moved between 42 and 55 across four identical calls. It
  surfaced as face crops working, then a few full photos, then working again. Order by
  `(media_id, face_index)`; it also keeps separate requests index-aligned.
- **`history.back()` to undo a manual `pushState` hard-reloads the App Router.** The
  lightbox pushed an entry so the back button would close it, then popped that entry on
  close. The traversal drops out of client-side routing into a full page load, which
  destroys all React state — a guest who ran a face search and opened one photo came
  back to the selfie prompt with their results gone. Preserving the router's own keys in
  the pushed state does *not* help; the traversal itself is the problem. Clear the marker
  with `replaceState` instead. Verify with `performance.timeOrigin`: it changes on a
  reload, and `navigation.type` flips from `navigate` to `reload`.
- **ONNX Runtime reports GPU while running on CPU.** CUDA registers, then the first
  Conv fails and every op silently falls back. The worker now proves a Conv actually
  executes on CUDA before claiming the GPU.

## Open issues

- ~~`candidates 200/200` saturates every search~~ — **checked, not a problem.** The
  0.20 prefilter admits 3,577 faces, so 200 slots always fill; saturation is not
  truncation. Scores flatten long before the cap: rank 50 scores 0.354, rank 200
  scores 0.321, rank 400 scores 0.301 — all far below the 0.44 bar a result must
  clear. In a live search only 77 of the 200 candidates cleared 0.44, so ~123 slots
  went unused. Raising `MAX_CANDIDATES` would only add faces that get rejected.
- **A scale-aware display floor was built and reverted.** A fixed 0.44 floor admits
  ~10x more strangers here than on a 600-face event. The implementation scaled the
  floor with gallery size (0.44 at ~600 faces, capped at 0.55) and would have cut the
  review band from 66 to 26. Reverted only because it landed at the same time as
  other changes and could not be evaluated in isolation. Revisit it separately.
