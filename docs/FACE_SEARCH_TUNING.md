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
