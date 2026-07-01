"""
PIXTRACE Local Face Worker
==========================

Runs the entire face pipeline on THIS machine instead of Modal, so you pay
nothing for online GPU. It polls the same two Supabase job queues Modal used:

  1. face_processing_jobs  — gallery embedding (organizer uploads photos)
  2. face_search_jobs      — guest selfie search

Because both queues live in Supabase and this worker *pulls* from them, the
laptop never needs to be reachable from the internet. No port forwarding, no
tunnel — only outbound access to Supabase + Cloudflare R2 is required.

The catch: face search only completes while this worker is running. If the
machine is asleep/off, jobs queue up and finish once it's back on.

Processing logic (detect -> align -> embed -> pgvector search) is a faithful
port of modal/face_pipeline.py, so results/thresholds are identical.

Usage
-----
  cd worker
  python -m venv .venv && .venv\\Scripts\\activate      (Windows)
  pip install -r requirements.txt
  copy .env.example .env   # then fill in values
  python face_worker.py

First run downloads the InsightFace buffalo_l model pack (~300 MB) to
~/.insightface/models/buffalo_l. Subsequent runs are instant.
"""

from __future__ import annotations

import base64
import math
import os
import signal
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

# ── Third-party ──────────────────────────────────────────────────────────────
try:
    import numpy as np
    import cv2
    import boto3
    from botocore.config import Config as BotoConfig
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError as exc:  # pragma: no cover
    sys.stderr.write(
        f"\nMissing dependency: {exc}\n"
        "Install requirements first:  pip install -r requirements.txt\n\n"
    )
    sys.exit(1)


# ── Configuration ────────────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME")

# How often to poll each queue (seconds). Search is latency-sensitive → poll fast.
SEARCH_POLL_INTERVAL = float(os.environ.get("SEARCH_POLL_INTERVAL", "3"))
GALLERY_POLL_INTERVAL = float(os.environ.get("GALLERY_POLL_INTERVAL", "15"))

# Batch sizes — mirror lib/face/constants.ts
GALLERY_BATCH_SIZE = int(os.environ.get("GALLERY_BATCH_SIZE", "50"))
SEARCH_BATCH_SIZE = int(os.environ.get("SEARCH_BATCH_SIZE", "5"))
STUCK_JOB_TIMEOUT_MINUTES = 10

# Force CPU even if a GPU is present (set WORKER_FORCE_CPU=1 to debug).
FORCE_CPU = os.environ.get("WORKER_FORCE_CPU", "").strip() in ("1", "true", "yes")

# ── Pipeline constants (must match lib/face/constants.ts & face_pipeline.py) ──
FACE_CROP_PADDING = 0.3
ALIGNED_FACE_SIZE = 112
APPLY_FINAL_ROT_180 = True
EMBEDDING_DIM = 512
L2_EPS = 1e-10

# Prototype-refinement config — mirrors the Streamlit Mode A "softmax" sweep-best
# result: softmax-weighted prototype, tau=1.0, threshold=0.50, 3 cycles
# (AP=0.9707, Rank-1/5/10=100% on the eval set).
TIER_1_THRESHOLD = 0.50   # seed pool + per-cycle expansion (raised from 0.44)
TIER_2_THRESHOLD = 0.50   # extra matches scored vs the refined prototype
REFINEMENT_CYCLES = 3
PROTO_TAU = 1.0           # softmax temperature for prototype weighting (higher = softer/closer to plain mean)
MAX_CANDIDATES = 200
SQL_PREFILTER = 0.20


def _fatal_config_check() -> None:
    missing = [
        name
        for name, val in [
            ("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
            ("R2_ACCOUNT_ID", R2_ACCOUNT_ID),
            ("R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID),
            ("R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY),
            ("R2_BUCKET_NAME", R2_BUCKET_NAME),
        ]
        if not val
    ]
    if missing:
        sys.stderr.write(
            "\nMissing required env vars:\n  - " + "\n  - ".join(missing) +
            "\n\nCopy .env.example to .env and fill these in.\n\n"
        )
        sys.exit(1)


# ── Logging helper ───────────────────────────────────────────────────────────
def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ── Numpy / image utilities (ported from face_pipeline.py) ───────────────────
def to_native(obj):
    """Recursively convert numpy types to Python native types for JSON/DB."""
    if isinstance(obj, dict):
        return {k: to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_native(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def l2_normalize(x, eps=L2_EPS):
    x = np.asarray(x, dtype=np.float32)
    n = np.linalg.norm(x, axis=-1, keepdims=True)
    return x / np.maximum(n, eps)


def decode_image(image_bytes: bytes):
    """Decode image bytes to BGR numpy array; Pillow fallback for WebP/HEIC."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is not None:
        return img
    try:
        from PIL import Image
        import io
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception:
        raise ValueError("Failed to decode image")


# ── Face detection / alignment / embedding (ported verbatim) ─────────────────
def detect_faces(detector, img_bgr):
    raw = detector.get(img_bgr)
    if not raw:
        return []
    faces = []
    for face in raw:
        x1, y1, x2, y2 = face.bbox
        kps = face.kps  # (5, 2)
        faces.append({
            "facial_area": [int(x1), int(y1), int(x2), int(y2)],
            "landmarks": {
                "right_eye":  (float(kps[0][0]), float(kps[0][1])),
                "left_eye":   (float(kps[1][0]), float(kps[1][1])),
                "nose":       (float(kps[2][0]), float(kps[2][1])),
                "mouth_left": (float(kps[3][0]), float(kps[3][1])),
                "mouth_right":(float(kps[4][0]), float(kps[4][1])),
            },
            "score": float(face.det_score),
        })
    return faces


def crop_face(img, facial_area, padding=FACE_CROP_PADDING):
    h, w = img.shape[:2]
    x1, y1, x2, y2 = facial_area
    box_w, box_h = x2 - x1, y2 - y1
    x1p = max(0, int(x1 - box_w * padding))
    y1p = max(0, int(y1 - box_h * padding))
    x2p = min(w, int(x2 + box_w * padding))
    y2p = min(h, int(y2 + box_h * padding))
    return img[y1p:y2p, x1p:x2p], (x1p, y1p, x2p, y2p)


def align_face(face_crop, landmarks, padded_bbox):
    x1p, y1p, _, _ = padded_bbox
    left_eye = (landmarks["left_eye"][0] - x1p, landmarks["left_eye"][1] - y1p)
    right_eye = (landmarks["right_eye"][0] - x1p, landmarks["right_eye"][1] - y1p)

    dx = right_eye[0] - left_eye[0]
    dy = right_eye[1] - left_eye[1]
    angle = float(np.degrees(np.arctan2(dy, dx)))
    eyes_center = (
        (left_eye[0] + right_eye[0]) / 2.0,
        (left_eye[1] + right_eye[1]) / 2.0,
    )

    M = cv2.getRotationMatrix2D(eyes_center, angle, scale=1.0)
    aligned = cv2.warpAffine(
        face_crop, M, (face_crop.shape[1], face_crop.shape[0]), flags=cv2.INTER_CUBIC,
    )
    aligned = cv2.resize(
        aligned, (ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE), interpolation=cv2.INTER_AREA,
    )
    if APPLY_FINAL_ROT_180:
        aligned = cv2.rotate(aligned, cv2.ROTATE_180)
    return aligned


def generate_embedding(recognizer, aligned_face_bgr):
    face_rgb = cv2.cvtColor(aligned_face_bgr, cv2.COLOR_BGR2RGB)
    embedding = recognizer.get_feat(face_rgb)
    embedding = np.squeeze(embedding)
    return l2_normalize(embedding).tolist()


def process_single_image(recognizer, image_bytes: bytes, detector) -> list[dict]:
    """Decode -> detect (retry once) -> crop -> align -> embed. Returns face dicts."""
    img_bgr = decode_image(image_bytes)

    faces = detect_faces(detector, img_bgr)
    if len(faces) == 0:
        faces = detect_faces(detector, img_bgr)  # retry transient miss
    if len(faces) == 0:
        return []

    results = []
    for idx, face in enumerate(faces):
        try:
            face_crop, padded_bbox = crop_face(img_bgr, face["facial_area"])
            if face_crop.size == 0:
                continue
            aligned = align_face(face_crop, face["landmarks"], padded_bbox)
            embedding = generate_embedding(recognizer, aligned)
            results.append({
                "face_index": idx,
                "embedding": embedding,
                "confidence": float(face["score"]),
                "bbox": [int(x) for x in face["facial_area"]],
            })
        except Exception as e:
            log(f"  ! error embedding face {idx}: {e}")
            continue
    return results


# ── pgvector search (ported from _run_face_search_py) ────────────────────────
def parse_embedding(raw):
    if isinstance(raw, list):
        return [float(v) for v in raw]
    if isinstance(raw, str):
        try:
            import json as _json
            return [float(v) for v in _json.loads(raw)]
        except Exception:
            pass
    return []


def build_prototype(embeddings, scores=None, tau=PROTO_TAU):
    """Build a face prototype as a softmax-score-weighted mean, L2-normalized.

    Mirrors the Streamlit Mode A "softmax" prototype: each seed face is weighted
    by softmax(combined_score / tau), so stronger matches shape the prototype more.
    Falls back to a plain (unweighted) mean when scores are unavailable.
    tau -> +inf approaches the plain mean; lower tau sharpens toward the best faces.
    """
    if not embeddings:
        return []
    arr = np.array(embeddings, dtype=np.float32)  # (M, D)
    if scores is None or len(scores) != len(embeddings):
        proto = arr.mean(axis=0)
    else:
        s = np.array(scores, dtype=np.float32) / max(float(tau), 1e-6)
        s -= s.max()                       # numerical stability
        w = np.exp(s)
        w /= w.sum()                       # softmax weights (M,)
        proto = (w[:, None] * arr).sum(axis=0)
    norm = float(np.linalg.norm(proto))
    if norm < 1e-10:
        return proto.tolist()
    return (proto / norm).tolist()


def run_face_search(supabase: Client, selfie_embedding, event_id):
    """Two-tier prototype-refinement search with a softmax-weighted prototype.

    Ports the Streamlit Mode A "softmax" sweep-best config: seed pool at
    TIER_1_THRESHOLD, a softmax-weighted prototype (PROTO_TAU) refined over
    REFINEMENT_CYCLES, tier-2 expansion scored against the final prototype, all on
    the same 0.8*cos + 0.2*exp(-0.5*L2) combined score computed in pgvector.
    """
    def to_pgvector(emb):
        return f'[{",".join(str(v) for v in emb)}]'

    def search(query_emb):
        result = supabase.rpc("search_face_embeddings", {
            "query_embedding": to_pgvector(query_emb),
            "target_event_id": event_id,
            "similarity_threshold": SQL_PREFILTER,
            "max_results": MAX_CANDIDATES,
        }).execute()
        return result.data or []

    # ── Step A: seed the tier-1 pool from the raw selfie ──────────────────────
    initial = search(selfie_embedding)

    tier1_face_ids = set()
    tier1_order = []          # face_id order, kept parallel to embeddings/scores
    tier1_embeddings = []
    tier1_scores = []         # combined_score, used as the softmax weight
    tier1_candidates = []     # [{face_id, media_id, score}]

    def _add_tier1(face, score) -> bool:
        emb = parse_embedding(face.get("embedding"))
        if not emb:
            return False
        fid = face["face_id"]
        tier1_face_ids.add(fid)
        tier1_order.append(fid)
        tier1_embeddings.append(emb)
        tier1_scores.append(score)
        tier1_candidates.append({"face_id": fid, "media_id": face["media_id"], "score": score})
        return True

    for face in initial:
        if face["combined_score"] >= TIER_1_THRESHOLD:
            _add_tier1(face, face["combined_score"])

    # ── Fallback: no strong seed → return best-guess matches so the UI still
    # shows something (mirrors face_engine.py's no-tier1 fallback). Prevents the
    # stricter 0.50 seed from ever producing zero results for a real match. ────
    if not tier1_embeddings:
        media_best: dict = {}
        for f in initial:
            mid = f["media_id"]
            if mid not in media_best or f["combined_score"] > media_best[mid]:
                media_best[mid] = f["combined_score"]
        tier2 = [{"media_id": m, "score": round(s * 1000) / 1000} for m, s in media_best.items()]
        tier2.sort(key=lambda x: x["score"], reverse=True)
        return {"tier1": [], "tier2": tier2, "prototype": selfie_embedding}

    # ── Step B: iterative softmax-weighted prototype refinement ───────────────
    current_proto = selfie_embedding
    for _ in range(REFINEMENT_CYCLES):
        current_proto = build_prototype(tier1_embeddings, tier1_scores, PROTO_TAU)
        proto_results = search(current_proto)
        proto_score = {f["face_id"]: f["combined_score"] for f in proto_results}

        added = 0
        for face in proto_results:
            fid = face["face_id"]
            score = face["combined_score"]
            if fid not in tier1_face_ids and score >= TIER_1_THRESHOLD:
                if _add_tier1(face, score):
                    added += 1

        # Refresh existing seeds' weights with this prototype's view so the next
        # cycle's softmax reflects the refined prototype (matches face_engine.py).
        for i, fid in enumerate(tier1_order):
            if fid in proto_score:
                tier1_scores[i] = proto_score[fid]

        if added == 0:
            break

    # ── Step C: final scoring vs the refined prototype (re-score tier-1 + tier-2) ──
    final_results = search(current_proto)
    final_score = {f["face_id"]: f["combined_score"] for f in final_results}

    for c in tier1_candidates:
        if c["face_id"] in final_score:
            c["score"] = final_score[c["face_id"]]

    tier2_candidates = []
    for face in final_results:
        fid = face["face_id"]
        score = face["combined_score"]
        if fid not in tier1_face_ids and score >= TIER_2_THRESHOLD:
            tier2_candidates.append({"face_id": fid, "media_id": face["media_id"], "score": score})

    tier1_media = {}
    for c in tier1_candidates:
        mid = c["media_id"]
        if mid not in tier1_media or c["score"] > tier1_media[mid]:
            tier1_media[mid] = c["score"]

    tier2_media = {}
    for c in tier2_candidates:
        mid = c["media_id"]
        if mid in tier1_media:
            continue
        if mid not in tier2_media or c["score"] > tier2_media[mid]:
            tier2_media[mid] = c["score"]

    tier1 = [{"media_id": m, "score": round(s * 1000) / 1000} for m, s in tier1_media.items()]
    tier2 = [{"media_id": m, "score": round(s * 1000) / 1000} for m, s in tier2_media.items()]
    tier1.sort(key=lambda x: x["score"], reverse=True)
    tier2.sort(key=lambda x: x["score"], reverse=True)

    return {"tier1": tier1, "tier2": tier2, "prototype": current_proto}


# ── Model loading (GPU with automatic CPU fallback) ──────────────────────────
_recognizer = None
_detector = None
_using_gpu = False


def load_models():
    """Load InsightFace detector + recognizer once. Uses CUDA if available."""
    global _recognizer, _detector, _using_gpu
    if _recognizer is not None:
        return _recognizer, _detector

    import insightface
    from insightface.model_zoo import get_model
    import onnxruntime as ort

    # onnxruntime-gpu ships without the CUDA/cuDNN runtime. When those are
    # provided via the nvidia-*-cu12 pip wheels, preload_dlls() puts them on the
    # DLL search path so the CUDA provider can actually load (otherwise ORT
    # silently falls back to CPU). Harmless no-op if the wheels aren't present.
    if not FORCE_CPU and hasattr(ort, "preload_dlls"):
        try:
            ort.preload_dlls()
        except Exception as e:
            log(f"preload_dlls() failed (will try anyway): {e}")

    available = ort.get_available_providers()
    if not FORCE_CPU and "CUDAExecutionProvider" in available:
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        ctx_id = 0
        _using_gpu = True
    else:
        providers = ["CPUExecutionProvider"]
        ctx_id = -1
        _using_gpu = False

    log(f"ONNX providers available: {available}")
    log(f"Loading InsightFace buffalo_l on {'GPU (CUDA)' if _using_gpu else 'CPU'} ...")

    # Detector (SCRFD) — detection module only. Auto-downloads buffalo_l on first run.
    detector = insightface.app.FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection"],
        providers=providers,
    )
    detector.prepare(ctx_id=ctx_id, det_size=(640, 640))

    # Recognizer (ArcFace w600k_r50) — loaded directly from the downloaded pack.
    model_path = os.path.join(
        os.path.expanduser("~"), ".insightface", "models", "buffalo_l", "w600k_r50.onnx"
    )
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Recognizer model not found at {model_path}. "
            "The buffalo_l download may have failed — re-run the worker."
        )
    recognizer = get_model(model_path, providers=providers)
    recognizer.prepare(ctx_id=ctx_id)

    _recognizer, _detector = recognizer, detector
    log("Models loaded.")
    return _recognizer, _detector


# ── R2 client ────────────────────────────────────────────────────────────────
_s3 = None


def get_r2():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=BotoConfig(signature_version="s3v4", retries={"max_attempts": 3}),
        )
    return _s3


def download_r2_object(key: str) -> bytes:
    resp = get_r2().get_object(Bucket=R2_BUCKET_NAME, Key=key)
    return resp["Body"].read()


# ── Queue 1: gallery embedding (replaces runTrigger + FacePipeline) ──────────
def process_gallery_batch(supabase: Client) -> int:
    """Claim pending gallery jobs, embed faces, write to face_embeddings.
    Returns number of jobs processed this round (0 = queue empty)."""
    claimed = supabase.rpc("claim_face_processing_jobs", {
        "max_jobs": GALLERY_BATCH_SIZE,
        "stuck_timeout_minutes": STUCK_JOB_TIMEOUT_MINUTES,
    }).execute()
    jobs = claimed.data or []
    if not jobs:
        return 0

    media_ids = [j["media_id"] for j in jobs]
    media_resp = supabase.table("media").select("id, r2_key, event_id").in_("id", media_ids).execute()
    media_by_id = {m["id"]: m for m in (media_resp.data or [])}

    recognizer, detector = load_models()
    log(f"[gallery] processing {len(jobs)} photo(s) ...")

    processed = 0
    for job in jobs:
        media_id = job["media_id"]
        media = media_by_id.get(media_id)
        now_iso = datetime.now(timezone.utc).isoformat()

        if not media:
            supabase.table("face_processing_jobs").update({
                "status": "failed",
                "error_message": "media row not found",
                "updated_at": now_iso,
            }).eq("media_id", media_id).execute()
            continue

        try:
            image_bytes = download_r2_object(media["r2_key"])
            faces = process_single_image(recognizer, image_bytes, detector)
            face_count = len(faces)

            if face_count > 0:
                rows = [to_native({
                    "media_id": media_id,
                    "event_id": media["event_id"],
                    "face_index": f["face_index"],
                    "embedding": f["embedding"],
                    "confidence": f["confidence"],
                    "bbox_x1": f["bbox"][0],
                    "bbox_y1": f["bbox"][1],
                    "bbox_x2": f["bbox"][2],
                    "bbox_y2": f["bbox"][3],
                }) for f in faces]
                supabase.table("face_embeddings").insert(rows).execute()
                supabase.table("face_processing_jobs").update({
                    "status": "completed",
                    "faces_found": face_count,
                    "completed_at": now_iso,
                    "updated_at": now_iso,
                }).eq("media_id", media_id).execute()
            else:
                supabase.table("face_processing_jobs").update({
                    "status": "no_faces",
                    "faces_found": 0,
                    "completed_at": now_iso,
                    "updated_at": now_iso,
                }).eq("media_id", media_id).execute()

            supabase.table("media").update({"face_count": face_count}).eq("id", media_id).execute()
            processed += 1
            log(f"  [gallery] {media_id}: {face_count} face(s)")

        except Exception as e:
            error_msg = str(e)[:500]
            log(f"  ! [gallery] {media_id} failed: {error_msg}")
            supabase.table("face_processing_jobs").update({
                "status": "failed",
                "error_message": error_msg,
                "updated_at": now_iso,
            }).eq("media_id", media_id).execute()

    return processed


# ── Queue 2: selfie search (replaces process_face_search_jobs cron) ──────────
def process_search_jobs(supabase: Client) -> int:
    """Cleanup, claim pending search jobs, embed + search, write results.
    Returns number of jobs processed this round (0 = queue empty)."""
    now = datetime.now(timezone.utc)

    # 1. Delete expired jobs (>2h old — expires_at set on insert)
    supabase.table("face_search_jobs").delete().lt("expires_at", now.isoformat()).execute()

    # 2. Fail jobs stuck in 'processing' > 10 min (crashed worker)
    stuck_cutoff = (now - timedelta(minutes=10)).isoformat()
    supabase.table("face_search_jobs").update({
        "status": "failed",
        "error": "Processing timed out — worker may have restarted. Please try again.",
        "completed_at": now.isoformat(),
    }).eq("status", "processing").lt("started_at", stuck_cutoff).execute()

    # 3. Fetch up to N pending jobs (FIFO)
    resp = supabase.table("face_search_jobs").select(
        "id, event_id, album_id, selfie_data, "
        "auth_user_id, auth_user_email, auth_user_name"
    ).eq("status", "pending").order("created_at").limit(SEARCH_BATCH_SIZE).execute()
    jobs = resp.data or []
    if not jobs:
        return 0

    recognizer, detector = load_models()
    log(f"[search] processing {len(jobs)} selfie(s) ...")

    processed = 0
    for job in jobs:
        job_id = job["id"]

        # Atomically claim: pending -> processing
        claim = supabase.table("face_search_jobs").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).eq("status", "pending").execute()
        if not claim.data:
            continue  # already claimed elsewhere

        try:
            selfie_data = job.get("selfie_data")
            if not selfie_data:
                raise ValueError("selfie_data missing from job record")

            image_bytes = base64.b64decode(selfie_data)
            faces = process_single_image(recognizer, image_bytes, detector)

            if not faces:
                supabase.table("face_search_jobs").update({
                    "status": "failed", "error": "no_face_detected",
                    "selfie_data": None,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                log(f"  [search] {job_id}: no face detected")
                continue

            best = max(faces, key=lambda f: f["confidence"])
            embedding = best["embedding"]

            if (not embedding or len(embedding) != EMBEDDING_DIM
                    or any(math.isnan(v) or math.isinf(v) for v in embedding)):
                supabase.table("face_search_jobs").update({
                    "status": "failed", "error": "invalid_embedding",
                    "selfie_data": None,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                continue

            search_result = run_face_search(supabase, embedding, job["event_id"])

            # Save face profile for recall (authenticated users with matches)
            auth_user_id = job.get("auth_user_id")
            prototype = search_result.get("prototype")
            total_matches = len(search_result["tier1"]) + len(search_result["tier2"])

            if auth_user_id and prototype and total_matches > 0:
                try:
                    gu_resp = supabase.table("gallery_users").upsert({
                        "auth_id": auth_user_id,
                        "email": job.get("auth_user_email") or "unknown",
                        "name": job.get("auth_user_name"),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }, on_conflict="auth_id").select("id").execute()
                    if gu_resp.data:
                        gu_id = gu_resp.data[0]["id"]
                        pg_vec = f'[{",".join(str(v) for v in prototype)}]'
                        supabase.table("face_search_profiles").upsert({
                            "gallery_user_id": gu_id,
                            "event_id": job["event_id"],
                            "prototype_embedding": pg_vec,
                            "match_count": total_matches,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }, on_conflict="gallery_user_id,event_id").execute()
                except Exception as e:
                    log(f"  ! [search] face profile save failed for {job_id}: {e}")

            supabase.table("face_search_jobs").update({
                "status": "completed",
                "result": {"tier1": search_result["tier1"], "tier2": search_result["tier2"]},
                "selfie_data": None,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", job_id).execute()

            processed += 1
            log(f"  [search] {job_id}: {len(search_result['tier1'])} tier1, "
                f"{len(search_result['tier2'])} tier2")

        except Exception as e:
            error_msg = str(e)[:500]
            log(f"  ! [search] {job_id} failed: {error_msg}")
            supabase.table("face_search_jobs").update({
                "status": "failed", "error": error_msg, "selfie_data": None,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", job_id).execute()

    return processed


# ── Main loop ────────────────────────────────────────────────────────────────
_running = True


def _handle_signal(signum, frame):
    global _running
    _running = False
    log("Shutdown requested — finishing current round ...")


def main() -> None:
    _fatal_config_check()
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    log("=" * 60)
    log("PIXTRACE local face worker starting")
    log(f"  Supabase : {SUPABASE_URL}")
    log(f"  R2 bucket: {R2_BUCKET_NAME}")
    log(f"  Search poll : every {SEARCH_POLL_INTERVAL}s")
    log(f"  Gallery poll: every {GALLERY_POLL_INTERVAL}s")
    log("=" * 60)

    # Warm the model once at startup so the first real job isn't slow.
    load_models()
    log(f"Worker ready - running on {'GPU' if _using_gpu else 'CPU'}. Press Ctrl+C to stop.")

    last_gallery_poll = 0.0
    while _running:
        loop_start = time.monotonic()

        # Search queue — every loop (fast cadence)
        try:
            done = process_search_jobs(supabase)
            # If we processed a full batch, keep draining before sleeping.
            while _running and done >= SEARCH_BATCH_SIZE:
                done = process_search_jobs(supabase)
        except Exception as e:
            log(f"! search loop error: {e}")

        # Gallery queue — throttled to its own interval
        if loop_start - last_gallery_poll >= GALLERY_POLL_INTERVAL:
            last_gallery_poll = loop_start
            try:
                done = process_gallery_batch(supabase)
                while _running and done >= GALLERY_BATCH_SIZE:
                    done = process_gallery_batch(supabase)
            except Exception as e:
                log(f"! gallery loop error: {e}")

        # Sleep out the remainder of the search interval
        elapsed = time.monotonic() - loop_start
        if _running and elapsed < SEARCH_POLL_INTERVAL:
            time.sleep(SEARCH_POLL_INTERVAL - elapsed)

    log("Worker stopped cleanly.")


if __name__ == "__main__":
    main()
