"""
PIXTRACE Face Processing Pipeline — Modal Server

Three endpoints across two classes:
  FacePipeline (GPU T4, batch processing):
    POST /process-gallery  — Batch process gallery photos (detect + align + embed)

  SelfieEmbedder (CPU-only, cost-optimized):
    POST /embed-selfie     — Single selfie embedding for face search

FacePipeline writes results directly to Supabase (pgvector) via service_role key.
SelfieEmbedder is stateless — returns embedding JSON, no DB writes.
"""

import modal
import os

# ---------------------------------------------------------------------------
# Modal app definition
# ---------------------------------------------------------------------------

# GPU image — full stack for batch gallery processing (includes Supabase client)
gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "opencv-python-headless==4.9.0.80",
        "numpy>=1.26,<2.0",
        "Pillow>=10.0",
        "insightface>=0.7.3",
        "onnxruntime-gpu>=1.17",
        "supabase>=2.0",
        "requests>=2.31",
        "fastapi[standard]",
    )
)

# CPU image — selfie embedding + async job processing (includes Supabase for cron)
cpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "opencv-python-headless==4.9.0.80",
        "numpy>=1.26,<2.0",
        "Pillow>=10.0",
        "insightface>=0.7.3",
        "onnxruntime>=1.17",
        "supabase>=2.0",
        "fastapi[standard]",
    )
)

app = modal.App("pixtrace-face-pipeline")

model_volume = modal.Volume.from_name("pixtrace-models", create_if_missing=True)

# ---------------------------------------------------------------------------
# Constants (must match lib/face/constants.ts)
# ---------------------------------------------------------------------------

FACE_CROP_PADDING = 0.3
ALIGNED_FACE_SIZE = 112
APPLY_FINAL_ROT_180 = True
EMBEDDING_DIM = 512
L2_EPS = 1e-10


# ---------------------------------------------------------------------------
# Utility functions (pure, no class dependency)
# ---------------------------------------------------------------------------

def to_native(obj):
    """Recursively convert numpy types to Python native types for JSON."""
    import numpy as np
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
    """L2-normalize a vector or batch of vectors."""
    import numpy as np
    x = np.asarray(x, dtype=np.float32)
    n = np.linalg.norm(x, axis=-1, keepdims=True)
    return x / np.maximum(n, eps)


def decode_image(image_bytes: bytes):
    """Decode image bytes to BGR numpy array (OpenCV format).
    Falls back to Pillow for formats OpenCV can't handle (e.g., WebP, HEIC)."""
    import numpy as np
    import cv2

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is not None:
        return img

    # Fallback: use Pillow which handles more formats
    try:
        from PIL import Image
        import io
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = pil_img.convert("RGB")
        img = np.array(pil_img)
        # Convert RGB to BGR for OpenCV
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        return img
    except Exception:
        raise ValueError("Failed to decode image")


def detect_faces(detector, img_bgr):
    """
    Run InsightFace SCRFD detection. Returns list of dicts with keys:
      facial_area: [x1, y1, x2, y2]
      landmarks: {left_eye, right_eye, nose, mouth_left, mouth_right}
      score: float
    """
    raw = detector.get(img_bgr)
    if not raw:
        return []

    faces = []
    for face in raw:
        x1, y1, x2, y2 = face.bbox
        kps = face.kps  # shape (5, 2)
        # Swap eye labels to match Streamlit face_engine.py convention:
        # kps[0] → "right_eye", kps[1] → "left_eye". This keeps the
        # alignment angle near 0° for upright faces so warpAffine does
        # minimal interpolation; the heavy rotation is handled by the
        # lossless ROTATE_180 pixel flip afterward.
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
    """Crop face region with padding from image."""
    h, w = img.shape[:2]
    x1, y1, x2, y2 = facial_area
    box_w = x2 - x1
    box_h = y2 - y1
    x1p = max(0, int(x1 - box_w * padding))
    y1p = max(0, int(y1 - box_h * padding))
    x2p = min(w, int(x2 + box_w * padding))
    y2p = min(h, int(y2 + box_h * padding))
    return img[y1p:y2p, x1p:x2p], (x1p, y1p, x2p, y2p)


def align_face(face_crop, landmarks, padded_bbox):
    """
    Align face: rotate so eyes are horizontal, resize to 112x112.
    Matches the prototype alignment in face_api_process.py.
    """
    import numpy as np
    import cv2

    x1p, y1p, _, _ = padded_bbox

    # Adjust landmarks to cropped coordinates
    left_eye = (landmarks["left_eye"][0] - x1p, landmarks["left_eye"][1] - y1p)
    right_eye = (landmarks["right_eye"][0] - x1p, landmarks["right_eye"][1] - y1p)

    # Compute rotation angle from eye-to-eye line
    dx = right_eye[0] - left_eye[0]
    dy = right_eye[1] - left_eye[1]
    angle = float(np.degrees(np.arctan2(dy, dx)))

    # Rotation center = midpoint between eyes
    eyes_center = (
        (left_eye[0] + right_eye[0]) / 2.0,
        (left_eye[1] + right_eye[1]) / 2.0,
    )

    M = cv2.getRotationMatrix2D(eyes_center, angle, scale=1.0)
    aligned = cv2.warpAffine(
        face_crop, M, (face_crop.shape[1], face_crop.shape[0]),
        flags=cv2.INTER_CUBIC,
    )

    # Resize to model input size
    aligned = cv2.resize(aligned, (ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE),
                         interpolation=cv2.INTER_AREA)

    # Apply 180-degree rotation (matches prototype behavior)
    if APPLY_FINAL_ROT_180:
        aligned = cv2.rotate(aligned, cv2.ROTATE_180)

    return aligned


def generate_embedding(model, aligned_face_bgr):
    """Generate 512-dim embedding from aligned 112x112 BGR face."""
    import numpy as np
    import cv2

    # InsightFace expects RGB uint8 (matching Streamlit face_engine.py)
    face_rgb = cv2.cvtColor(aligned_face_bgr, cv2.COLOR_BGR2RGB)

    embedding = model.get_feat(face_rgb)
    embedding = np.squeeze(embedding)

    # L2-normalize
    embedding = l2_normalize(embedding)
    return embedding.tolist()


def _process_single_image(recognizer, image_bytes: bytes, detector=None) -> list[dict]:
    """
    Full pipeline for one image:
    1. Decode -> 2. Detect faces -> 3. Crop -> 4. Align -> 5. Embed

    Returns list of face dicts, each with:
      face_index, embedding (512 floats), confidence, bbox (x1,y1,x2,y2)

    If 0 faces detected on first try, retries detection once.
    """
    import cv2

    img_bgr = decode_image(image_bytes)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    # Detect faces (with retry on 0 faces)
    faces = detect_faces(detector, img_bgr)
    if len(faces) == 0:
        # Retry once — compensate transient model failure
        faces = detect_faces(detector, img_bgr)

    if len(faces) == 0:
        return []

    results = []
    for idx, face in enumerate(faces):
        try:
            facial_area = face["facial_area"]
            landmarks = face["landmarks"]
            confidence = face["score"]

            # Crop with padding
            face_crop, padded_bbox = crop_face(img_bgr, facial_area)

            if face_crop.size == 0:
                continue

            # Align (eye rotation + resize to 112x112)
            aligned = align_face(face_crop, landmarks, padded_bbox)

            # Generate embedding
            embedding = generate_embedding(recognizer, aligned)

            results.append({
                "face_index": idx,
                "embedding": embedding,
                "confidence": float(confidence),
                "bbox": [int(x) for x in facial_area],
            })
        except Exception as e:
            print(f"Error processing face {idx}: {e}")
            continue

    return results


# ---------------------------------------------------------------------------
# GPU class — batch gallery processing only
# ---------------------------------------------------------------------------

@app.cls(
    image=gpu_image,
    gpu="T4",
    timeout=600,
    scaledown_window=60,
    volumes={"/models": model_volume},
    secrets=[modal.Secret.from_name("pixtrace-env")],
)
class FacePipeline:

    @modal.enter()
    def load_models(self):
        """Load InsightFace detector + recognizer once on container start."""
        import insightface
        from insightface.model_zoo import get_model

        model_path = "/models/w600k_r50.onnx"

        # Download model to volume if not present
        if not os.path.exists(model_path):
            print("Downloading InsightFace model to volume...")
            model_dir = "/models"
            os.makedirs(model_dir, exist_ok=True)

            # Download buffalo_l (includes both detector and recognizer)
            _bootstrap = insightface.app.FaceAnalysis(
                name="buffalo_l",
                root="/models",
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
            )
            _bootstrap.prepare(ctx_id=0, det_size=(640, 640))

            # Copy recognizer model to flat path for direct loading
            from glob import glob
            onnx_files = glob("/models/models/buffalo_l/*.onnx")
            for f in onnx_files:
                if "w600k" in f.lower():
                    import shutil
                    shutil.copy2(f, model_path)
                    break

            model_volume.commit()
            print("Model downloaded and cached in volume.")

        # SCRFD detector — detection only, no recognition module loaded twice
        self.detector = insightface.app.FaceAnalysis(
            name="buffalo_l",
            root="/models",
            allowed_modules=["detection"],
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.detector.prepare(ctx_id=0, det_size=(640, 640))

        # ArcFace recognition model (GPU)
        self.recognizer = get_model(model_path)
        self.recognizer.prepare(ctx_id=0)

        print("FacePipeline (GPU) models loaded successfully.")

    @modal.fastapi_endpoint(method="POST")
    def process_gallery(self, request: dict):
        """
        Batch process gallery photos.

        Input: {
          "media_items": [{"media_id": str, "r2_url": str}],
          "event_id": str,
          "secret": str
        }

        For each image:
        - Download from R2
        - Run face pipeline (detect, align, embed) with retry on 0 faces
        - Write embeddings to Supabase face_embeddings table
        - Update face_processing_jobs status
        - Update media.face_count

        Returns summary of processing results.
        """
        import requests as http_requests
        from supabase import create_client
        from datetime import datetime, timezone

        # Verify secret
        expected_secret = os.environ.get("FACE_PROCESSING_SECRET", "")
        if request.get("secret") != expected_secret:
            return {"error": "unauthorized"}, 401

        event_id = request.get("event_id")
        media_items = request.get("media_items", [])

        if not event_id or not media_items:
            return {"error": "missing event_id or media_items"}, 400

        # Init Supabase client
        supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )

        results_summary = {
            "total": len(media_items),
            "processed": 0,
            "faces_found": 0,
            "no_faces": 0,
            "failed": 0,
            "errors": [],
        }

        for item in media_items:
            media_id = item["media_id"]
            r2_url = item["r2_url"]

            try:
                # Download image from R2
                resp = http_requests.get(r2_url, timeout=30)
                if resp.status_code != 200:
                    # Retry download once
                    resp = http_requests.get(r2_url, timeout=30)
                    if resp.status_code != 200:
                        raise Exception(f"R2 download failed: HTTP {resp.status_code}")

                image_bytes = resp.content

                # Run face pipeline
                faces = _process_single_image(self.recognizer, image_bytes, self.detector)
                face_count = len(faces)

                if face_count > 0:
                    # Write embeddings to Supabase
                    rows = []
                    for face in faces:
                        rows.append(to_native({
                            "media_id": media_id,
                            "event_id": event_id,
                            "face_index": face["face_index"],
                            "embedding": face["embedding"],
                            "confidence": face["confidence"],
                            "bbox_x1": face["bbox"][0],
                            "bbox_y1": face["bbox"][1],
                            "bbox_x2": face["bbox"][2],
                            "bbox_y2": face["bbox"][3],
                        }))
                    supabase.table("face_embeddings").insert(rows).execute()

                    results_summary["faces_found"] += face_count

                    # Update job status
                    supabase.table("face_processing_jobs").update({
                        "status": "completed",
                        "faces_found": face_count,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("media_id", media_id).execute()
                else:
                    results_summary["no_faces"] += 1

                    supabase.table("face_processing_jobs").update({
                        "status": "no_faces",
                        "faces_found": 0,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("media_id", media_id).execute()

                # Update media.face_count
                supabase.table("media").update({
                    "face_count": face_count,
                }).eq("id", media_id).execute()

                results_summary["processed"] += 1

            except Exception as e:
                error_msg = str(e)[:500]
                results_summary["failed"] += 1
                results_summary["errors"].append({
                    "media_id": media_id,
                    "error": error_msg,
                })

                # Mark job as failed with error
                try:
                    supabase.table("face_processing_jobs").update({
                        "status": "failed",
                        "error_message": error_msg,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("media_id", media_id).execute()
                except Exception:
                    pass  # Don't fail the batch for a status update error

                print(f"Error processing {media_id}: {error_msg}")
                continue

        return results_summary


# ---------------------------------------------------------------------------
# CPU class — single selfie embedding (cost-optimized, no GPU needed)
# ---------------------------------------------------------------------------

@app.cls(
    image=cpu_image,
    cpu=2,
    memory=2048,
    timeout=120,
    scaledown_window=60,
    volumes={"/models": model_volume},
    secrets=[modal.Secret.from_name("pixtrace-env")],
)
class SelfieEmbedder:

    @modal.enter()
    def load_models(self):
        """Load InsightFace detector + recognizer on CPU."""
        import insightface
        from insightface.model_zoo import get_model

        model_path = "/models/w600k_r50.onnx"

        if not os.path.exists(model_path):
            # Model should already be cached by FacePipeline's first run.
            # If not, download it here (CPU-only providers).
            print("Downloading InsightFace model to volume (CPU)...")
            model_dir = "/models"
            os.makedirs(model_dir, exist_ok=True)

            _bootstrap = insightface.app.FaceAnalysis(
                name="buffalo_l",
                root="/models",
                providers=["CPUExecutionProvider"],
            )
            _bootstrap.prepare(ctx_id=-1, det_size=(640, 640))

            from glob import glob
            onnx_files = glob("/models/models/buffalo_l/*.onnx")
            for f in onnx_files:
                if "w600k" in f.lower():
                    import shutil
                    shutil.copy2(f, model_path)
                    break

            model_volume.commit()
            print("Model downloaded and cached in volume (CPU).")

        # SCRFD detector — detection only
        self.detector = insightface.app.FaceAnalysis(
            name="buffalo_l",
            root="/models",
            allowed_modules=["detection"],
            providers=["CPUExecutionProvider"],
        )
        self.detector.prepare(ctx_id=-1, det_size=(640, 640))

        # ArcFace recognition model (CPU)
        self.recognizer = get_model(model_path)
        self.recognizer.prepare(ctx_id=-1)

        print("SelfieEmbedder (CPU) model loaded successfully.")

    @modal.fastapi_endpoint(method="POST")
    def embed_selfie(self, request: dict):
        """
        Generate embedding for a single selfie image.

        Input: { "image_base64": str, "secret": str }

        Returns:
          Success: { "embedding": [512 floats], "confidence": float, "face_count": int }
          No face: { "error": "no_face_detected", "face_count": 0 }
        """
        import base64

        expected_secret = os.environ.get("FACE_PROCESSING_SECRET", "")
        if request.get("secret") != expected_secret:
            return {"error": "unauthorized"}, 401

        image_b64 = request.get("image_base64")
        if not image_b64:
            return {"error": "missing image_base64"}, 400

        try:
            image_bytes = base64.b64decode(image_b64)
        except Exception:
            return {"error": "invalid_base64"}

        try:
            faces = _process_single_image(self.recognizer, image_bytes, self.detector)
        except ValueError as e:
            print(f"Image decode error: {e}")
            return {"error": "invalid_image", "message": str(e)}
        except Exception as e:
            print(f"Face processing error: {e}")
            return {"error": "processing_failed", "message": str(e)[:200]}

        if len(faces) == 0:
            return {"error": "no_face_detected", "face_count": 0}

        # Pick the highest-confidence face (matching Streamlit face_engine.py)
        best_face = max(faces, key=lambda f: f["confidence"])

        # Validate embedding for NaN/Inf
        import math
        embedding = best_face["embedding"]
        if any(math.isnan(v) or math.isinf(v) for v in embedding):
            return {"error": "invalid_embedding", "face_count": 0}

        return to_native({
            "embedding": embedding,
            "confidence": best_face["confidence"],
            "face_count": len(faces),
        })


# ---------------------------------------------------------------------------
# Async face search job processing — cron-driven, no Vercel timeout risk
# ---------------------------------------------------------------------------

# Module-level model cache — persists across invocations in same container.
_cron_recognizer = None
_cron_detector = None


def _get_cron_models():
    """Lazy-load InsightFace detector + recognizer for the cron container."""
    global _cron_recognizer, _cron_detector
    if _cron_recognizer is not None and _cron_detector is not None:
        return _cron_recognizer, _cron_detector

    import insightface
    from insightface.model_zoo import get_model

    model_path = "/models/w600k_r50.onnx"
    if not os.path.exists(model_path):
        raise RuntimeError(
            "Model not found at /models/w600k_r50.onnx — deploy SelfieEmbedder "
            "first (it downloads the model to the shared volume on first run)."
        )

    detector = insightface.app.FaceAnalysis(
        name="buffalo_l",
        root="/models",
        allowed_modules=["detection"],
        providers=["CPUExecutionProvider"],
    )
    detector.prepare(ctx_id=-1, det_size=(640, 640))

    recognizer = get_model(model_path)
    recognizer.prepare(ctx_id=-1)  # CPU-only

    print("[cron] InsightFace models loaded.")
    _cron_recognizer = recognizer
    _cron_detector = detector
    return _cron_recognizer, _cron_detector


def _parse_embedding_py(raw):
    """Parse pgvector string '[0.1,0.2,...]' or list to list[float]."""
    if isinstance(raw, list):
        return [float(v) for v in raw]
    if isinstance(raw, str):
        try:
            import json as _json
            parsed = _json.loads(raw)
            return [float(v) for v in parsed]
        except Exception:
            pass
    return []


def _build_prototype_py(embeddings):
    """Compute L2-normalized mean of a list of embeddings."""
    import numpy as np
    if not embeddings:
        return []
    arr = np.array(embeddings, dtype=np.float32)
    mean = arr.mean(axis=0)
    norm = float(np.linalg.norm(mean))
    if norm < 1e-10:
        return mean.tolist()
    return (mean / norm).tolist()


def _run_face_search_py(supabase, selfie_embedding, event_id):
    """
    Python port of face_engine.py search_gallery() logic.
    Returns {tier1: [{media_id, score}], tier2: [...], prototype: [...]}

    Matches face_engine.py exactly:
    - TIER1 = 0.44 (against selfie, then expanded via prototype)
    - TIER2 = 0.50 (against refined prototype, NOT in tier1)
    - 3 refinement cycles
    """
    TIER_1_THRESHOLD = 0.44
    TIER_2_THRESHOLD = 0.50
    REFINEMENT_CYCLES = 3
    MAX_CANDIDATES = 200
    SQL_PREFILTER = 0.20  # Loose SQL-level cosine pre-filter; real filtering in Python

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

    # Step A: initial search with selfie embedding → collect tier1
    initial = search(selfie_embedding)

    tier1_face_ids = set()
    tier1_embeddings = []
    tier1_candidates = []  # [{face_id, media_id, score}]

    for face in initial:
        fid = face["face_id"]
        score = face["combined_score"]
        if score >= TIER_1_THRESHOLD:
            tier1_face_ids.add(fid)
            emb = _parse_embedding_py(face.get("embedding"))
            if emb:
                tier1_embeddings.append(emb)
            tier1_candidates.append({
                "face_id": fid, "media_id": face["media_id"], "score": score,
            })

    current_proto = selfie_embedding

    # Step B: iterative refinement — expand tier1 using prototype
    if tier1_embeddings:
        for _ in range(REFINEMENT_CYCLES):
            current_proto = _build_prototype_py(tier1_embeddings)
            proto_results = search(current_proto)

            added = 0
            for face in proto_results:
                fid = face["face_id"]
                score = face["combined_score"]
                if fid not in tier1_face_ids and score >= TIER_1_THRESHOLD:
                    tier1_face_ids.add(fid)
                    emb = _parse_embedding_py(face.get("embedding"))
                    if emb:
                        tier1_embeddings.append(emb)
                    tier1_candidates.append({
                        "face_id": fid, "media_id": face["media_id"], "score": score,
                    })
                    added += 1

            if added == 0:
                break  # converged

    # Step C: final search with refined prototype → tier2
    # Matches face_engine.py: tier2 = prototype matches >= TIER_2_THRESHOLD, NOT in tier1
    tier2_candidates = []
    if current_proto is not selfie_embedding:
        for face in search(current_proto):
            fid = face["face_id"]
            score = face["combined_score"]
            if fid not in tier1_face_ids and score >= TIER_2_THRESHOLD:
                tier2_candidates.append({
                    "face_id": fid, "media_id": face["media_id"], "score": score,
                })

    # Step D: deduplicate by media_id (keep highest score per photo)
    tier1_media = {}
    for c in tier1_candidates:
        mid = c["media_id"]
        if mid not in tier1_media or c["score"] > tier1_media[mid]:
            tier1_media[mid] = c["score"]

    tier2_media = {}
    for c in tier2_candidates:
        mid = c["media_id"]
        if mid in tier1_media:
            continue  # already in tier1
        if mid not in tier2_media or c["score"] > tier2_media[mid]:
            tier2_media[mid] = c["score"]

    tier1 = [{"media_id": mid, "score": round(s * 1000) / 1000}
             for mid, s in tier1_media.items()]
    tier2 = [{"media_id": mid, "score": round(s * 1000) / 1000}
             for mid, s in tier2_media.items()]

    tier1.sort(key=lambda x: x["score"], reverse=True)
    tier2.sort(key=lambda x: x["score"], reverse=True)

    return {"tier1": tier1, "tier2": tier2, "prototype": current_proto}


def _send_alert_email(subject, body):
    """
    Send an alert email via Resend (https://resend.com).
    Requires RESEND_API_KEY and ALERT_EMAIL in Modal secrets.
    Silently skips if not configured.
    """
    import urllib.request
    import json as _json

    api_key = os.environ.get("RESEND_API_KEY", "")
    alert_email = os.environ.get("ALERT_EMAIL", "")
    if not api_key or not alert_email:
        print(f"[alert] Email not configured. Subject: {subject}\n{body}")
        return

    payload = _json.dumps({
        "from": "alerts@pixtrace.in",
        "to": [alert_email],
        "subject": subject,
        "text": body,
    }).encode()

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception as e:
        print(f"[alert] Failed to send email: {e}")


@app.function(
    image=cpu_image,
    cpu=2,
    memory=2048,
    timeout=300,           # 5 min: enough for cold start (60s) + up to 5 jobs × 30s each
    scaledown_window=120,  # stay warm between 60s cron runs to avoid cold starts
    volumes={"/models": model_volume},
    secrets=[modal.Secret.from_name("pixtrace-env")],
    schedule=modal.Period(seconds=60),
)
def process_face_search_jobs():
    """
    Cron: runs every 60 seconds.
    1. Cleans up expired jobs.
    2. Detects and fails stuck jobs.
    3. Claims up to 5 pending jobs and processes them:
       selfie embed → pgvector search → write results → save face profile.
    4. Sends alert email on failure if RESEND_API_KEY is configured.
    """
    import base64
    import math
    from datetime import datetime, timezone, timedelta
    from supabase import create_client

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    now = datetime.now(timezone.utc)

    # 1. Delete expired jobs (>2h old)
    supabase.table("face_search_jobs").delete().lt(
        "expires_at", now.isoformat()
    ).execute()

    # 2. Fail jobs stuck in 'processing' for >10 minutes (crashed containers)
    stuck_cutoff = (now - timedelta(minutes=10)).isoformat()
    supabase.table("face_search_jobs").update({
        "status": "failed",
        "error": "Processing timed out — Modal container may have crashed. Please try again.",
        "completed_at": now.isoformat(),
    }).eq("status", "processing").lt("started_at", stuck_cutoff).execute()

    # 3. Fetch up to 5 pending jobs (FIFO)
    resp = supabase.table("face_search_jobs").select(
        "id, event_id, album_id, selfie_data, "
        "auth_user_id, auth_user_email, auth_user_name"
    ).eq("status", "pending").order("created_at").limit(5).execute()

    jobs = resp.data or []
    if not jobs:
        return  # Nothing to do — exit fast (< 1s compute)

    recognizer, detector = _get_cron_models()

    for job in jobs:
        job_id = job["id"]

        # Atomically claim: pending → processing (prevents duplicate processing)
        claim = supabase.table("face_search_jobs").update({
            "status": "processing",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).eq("status", "pending").execute()

        if not claim.data:
            continue  # Another cron run already claimed this job

        try:
            selfie_data = job.get("selfie_data")
            if not selfie_data:
                raise ValueError("selfie_data is missing from job record")

            image_bytes = base64.b64decode(selfie_data)

            # Embed selfie
            faces = _process_single_image(recognizer, image_bytes, detector)

            if not faces:
                supabase.table("face_search_jobs").update({
                    "status": "failed",
                    "error": "no_face_detected",
                    "selfie_data": None,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                continue

            # Pick the highest-confidence face (matching Streamlit face_engine.py)
            best = max(faces, key=lambda f: f["confidence"])
            embedding = best["embedding"]

            if not embedding or len(embedding) != 512 or any(
                math.isnan(v) or math.isinf(v) for v in embedding
            ):
                supabase.table("face_search_jobs").update({
                    "status": "failed",
                    "error": "invalid_embedding",
                    "selfie_data": None,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                continue

            # Run pgvector search
            search_result = _run_face_search_py(supabase, embedding, job["event_id"])

            # Save face profile for recall feature (authenticated users only)
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
                    # Non-critical: face profile saving failure must not fail the search
                    print(f"[cron] Failed to save face profile for job {job_id}: {e}")

            # Store result; clear selfie_data to free storage
            supabase.table("face_search_jobs").update({
                "status": "completed",
                "result": {"tier1": search_result["tier1"], "tier2": search_result["tier2"]},
                "selfie_data": None,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", job_id).execute()

            print(
                f"[cron] Job {job_id} completed: "
                f"{len(search_result['tier1'])} tier1, {len(search_result['tier2'])} tier2"
            )

        except Exception as e:
            error_msg = str(e)[:500]
            print(f"[cron] Job {job_id} failed: {error_msg}")

            supabase.table("face_search_jobs").update({
                "status": "failed",
                "error": error_msg,
                "selfie_data": None,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", job_id).execute()

            _send_alert_email(
                subject="[PIXTRACE] Face search job failed",
                body=(
                    f"Job ID:  {job_id}\n"
                    f"Event:   {job.get('event_id')}\n"
                    f"Error:   {error_msg}\n\n"
                    f"Check Modal logs for details."
                ),
            )
