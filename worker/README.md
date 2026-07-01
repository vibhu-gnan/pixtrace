# PIXTRACE Local Face Worker

Runs the face pipeline (gallery embedding + selfie search) on **your machine**
instead of Modal, so you pay **nothing** for online GPU.

## How it works

Both face features are queued in Supabase tables. Modal used to poll those
queues; now this worker does — from your laptop.

```
Organizer uploads photos ─► face_processing_jobs ─┐
                                                   ├─► [ this worker ] ─► face_embeddings (pgvector)
Guest uploads selfie ─────► face_search_jobs ─────┘        │
                                                           └─► writes results back ─► guest's browser polls & sees photos
```

Because the worker **pulls** jobs, your machine never needs to be reachable from
the internet. No port forwarding, no tunnel, no static IP — just outbound access
to Supabase and Cloudflare R2.

> **The one catch:** face search only completes while this worker is running.
> If the machine is asleep/off, searches sit in the queue and finish once it's
> back on. Gallery embedding is a background batch, so delay there is invisible.

## Setup (Windows)

```powershell
cd worker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

copy .env.example .env
# edit .env — fill in Supabase + R2 values (same as your web app)

python face_worker.py
```

First run downloads the InsightFace `buffalo_l` model pack (~300 MB) to
`~/.insightface/models/buffalo_l`. After that, startup is a few seconds.

## GPU (CUDA)

`requirements.txt` installs `onnxruntime-gpu` **plus the CUDA 12 + cuDNN 9 runtime
as pip wheels** (`nvidia-*-cu12`). No manual CUDA Toolkit install is needed — the
worker calls `onnxruntime.preload_dlls()` at startup to put those DLLs on the
search path. This was verified working on an RTX 4060 (driver 576.57).

- **CPU-only machine?** Delete the four `nvidia-*-cu12` lines from
  `requirements.txt` (saves ~2 GB). The worker auto-falls back to CPU; selfie
  embed is ≈ 1–2 s, still fine.
- **Force CPU for debugging:** set `WORKER_FORCE_CPU=1` in `.env`.

On startup the worker logs which provider it picked:

```
[12:00:01] ONNX providers available: ['CUDAExecutionProvider', 'CPUExecutionProvider']
[12:00:01] Loading InsightFace buffalo_l on GPU (CUDA) ...
[12:00:06] Worker ready — running on GPU. Press Ctrl+C to stop.
```

If it says CPU but you expected GPU, CUDA/cuDNN isn't visible to onnxruntime.

## DEV vs PROD

Point `.env` at whichever database + bucket you want to serve:

| | Supabase URL | R2 bucket |
|---|---|---|
| DEV  | `wxmlksgtjwlujstcbbel.supabase.co` | `pixtrace-media-dev` |
| PROD | `mpgnrtbhdcbenxwhutms.supabase.co` | `pixtrace-media` |

Serving PROD from your laptop means real guests' searches run on your machine —
so keep it running whenever the site is live.

## Switching off Modal

Since the worker claims gallery jobs directly via the `claim_face_processing_jobs`
RPC, the Vercel cron that dispatched to Modal is now redundant. Remove the
`/api/face/trigger` entry from `vercel.json` (or leave it — with
`MODAL_PROCESS_GALLERY_URL` unset it just no-ops with a 503). You can also stop
the Modal app entirely (`modal app stop pixtrace-face-pipeline`) once you've
confirmed the worker handles both queues.

## Running it reliably

- **Keep it alive:** run in a terminal you leave open, or wrap it with
  [NSSM](https://nssm.cc/) to run as a Windows service that restarts on crash/boot.
- **Prevent sleep:** if serving PROD, set the machine to never sleep while
  plugged in (Windows Settings → Power), or searches will stall when it sleeps.
- The worker is crash-safe: jobs it claims but doesn't finish are automatically
  un-stuck after 10 minutes and retried on the next run.
