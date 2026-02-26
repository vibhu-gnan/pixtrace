"""
PIXTRACE Face Processing Pipeline — Modal GPU Server

Two endpoints:
  POST /process-gallery  — Batch process gallery photos (detect + align + embed)
  POST /embed-selfie     — Single selfie embedding for face search

Writes results directly to Supabase (pgvector) via service_role key.
"""

import modal
import os

# ---------------------------------------------------------------------------
# Modal app definition
# ---------------------------------------------------------------------------

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "opencv-python-headless==4.9.0.80",
        "numpy>=1.26,<2.0",
        "Pillow>=10.0",
        "tf-keras",
        "retina-face>=0.0.17",
        "insightface>=0.7.3",
        "onnxruntime-gpu>=1.17",
        "supabase>=2.0",
        "requests>=2.31",
        "fastapi[standard]",
    )
)

app = modal.App("pixtrace-face-pipeline", image=image)

model_volume = modal.Volume.from_name("pixtrace-models", create_if_missing=True)

# ---------------------------------------------------------------------------
# Constants (must match lib/face/constants.ts)
# ---------------------------------------------------------------------------

FACE_CROP_PADDING = 0.2
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
    """Decode image bytes to BGR numpy array (OpenCV format)."""
    import numpy as np
    import cv2
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image")
    return img


def detect_faces(detector, img_rgb):
    """
    Run RetinaFace detection. Returns list of dicts with keys:
      facial_area: [x1, y1, x2, y2]
      landmarks: {left_eye, right_eye, nose, mouth_left, mouth_right}
      score: float
    """
    from retinaface import RetinaFace
    results = RetinaFace.detect_faces(img_rgb)

    if not isinstance(results, dict) or len(results) == 0:
        return []

    faces = []
    for key in sorted(results.keys()):
        face = results[key]
        fa = face.get("facial_area", [])
        landmarks = face.get("landmarks", {})
        score = face.get("score", 0.0)
        if len(fa) == 4 and landmarks:
            faces.append({
                "facial_area": fa,
                "landmarks": landmarks,
                "score": float(score),
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

    # InsightFace expects RGB
    face_rgb = cv2.cvtColor(aligned_face_bgr, cv2.COLOR_BGR2RGB)
    face_rgb = np.asarray(face_rgb, dtype=np.float32)

    # model.get_feat expects (H, W, C) or batch
    embedding = model.get_feat(face_rgb)
    embedding = np.squeeze(embedding)

    # L2-normalize
    embedding = l2_normalize(embedding)
    return embedding.tolist()


# ---------------------------------------------------------------------------
# Main pipeline class
# ---------------------------------------------------------------------------

@app.cls(
    gpu="T4",
    timeout=600,
    scaledown_window=300,
    volumes={"/models": model_volume},
    secrets=[modal.Secret.from_name("pixtrace-env")],
)
class FacePipeline:

    @modal.enter()
    def load_models(self):
        """Load RetinaFace + InsightFace once on container start."""
        import insightface
        from insightface.model_zoo import get_model

        model_path = "/models/w600k_r50.onnx"

        # Download model to volume if not present
        if not os.path.exists(model_path):
            print("Downloading InsightFace model to volume...")
            # Use insightface's model zoo to download
            model_dir = "/models"
            os.makedirs(model_dir, exist_ok=True)

            # Download buffalo_l which contains w600k_r50
            app_model = insightface.app.FaceAnalysis(
                name="buffalo_l",
                root="/models",
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
            )
            app_model.prepare(ctx_id=0, det_size=(640, 640))

            # Find the recognition model
            from glob import glob
            onnx_files = glob("/models/models/buffalo_l/*.onnx")
            for f in onnx_files:
                if "w600k" in f.lower():
                    import shutil
                    shutil.copy2(f, model_path)
                    break

            model_volume.commit()
            print("Model downloaded and cached in volume.")

        # Load the recognition model
        self.recognizer = get_model(model_path)
        self.recognizer.prepare(ctx_id=0)

        print("Models loaded successfully.")

    def process_single_image(self, image_bytes: bytes) -> list[dict]:
        """
        Full pipeline for one image:
        1. Decode → 2. Detect faces → 3. Crop → 4. Align → 5. Embed

        Returns list of face dicts, each with:
          face_index, embedding (512 floats), confidence, bbox (x1,y1,x2,y2)

        If 0 faces detected on first try, retries detection once.
        """
        import cv2

        img_bgr = decode_image(image_bytes)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # Detect faces (with retry on 0 faces)
        faces = detect_faces(None, img_rgb)
        if len(faces) == 0:
            # Retry once — compensate transient model failure
            faces = detect_faces(None, img_rgb)

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
                embedding = generate_embedding(self.recognizer, aligned)

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
                faces = self.process_single_image(image_bytes)
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
            return {"error": "invalid base64"}, 400

        faces = self.process_single_image(image_bytes)

        if len(faces) == 0:
            return {"error": "no_face_detected", "face_count": 0}

        # Pick the largest face (by bounding box area)
        best_face = max(faces, key=lambda f: (
            (f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1])
        ))

        return {
            "embedding": best_face["embedding"],
            "confidence": best_face["confidence"],
            "face_count": len(faces),
        }
