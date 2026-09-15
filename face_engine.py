"""
face_engine.py — On-the-fly selfie embedding + FAISS gallery search.

Public API
----------
  load_insightface_model(model_path: str) -> model
  load_gallery_index(gallery_json, aligned_faces_root) -> (index, meta, matrix)
  embed_selfie(pil_image, insightface_model) -> np.ndarray  shape (D,)
  embed_face_from_crop(pil_image, insightface_model) -> Optional[np.ndarray]  shape (D,) or None
  search_gallery(selfie_emb, index, meta, matrix, threshold, top_n) -> (list[dict], np.ndarray)
  face_recheck_score(selfie_emb, crop_emb) -> float
"""

from __future__ import annotations

import json
import logging
import os
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


# ─── InsightFace ONNX face detector ──────────────────────────────────────────
# Uses det_10g.onnx bundled with buffalo_l — no TensorFlow/Keras dependency.
_detector_cache = None


def _get_detector():
    """Lazily load the InsightFace ONNX face detector from the buffalo_l pack."""
    global _detector_cache
    if _detector_cache is not None:
        return _detector_cache

    import insightface  # type: ignore
    import onnxruntime as ort  # type: ignore

    det_path = os.path.join(
        os.path.expanduser("~"), ".insightface", "models", "buffalo_l", "det_10g.onnx"
    )
    if not os.path.exists(det_path):
        raise FileNotFoundError(
            f"InsightFace detection model not found: {det_path}\n"
            "Re-download buffalo_l:\n"
            "  python -c \"import insightface; "
            "insightface.app.FaceAnalysis('buffalo_l').prepare(ctx_id=-1)\""
        )

    providers = ort.get_available_providers()
    ctx_id = 0 if any(p != "CPUExecutionProvider" for p in providers) else -1

    det = insightface.model_zoo.get_model(det_path)
    det.prepare(ctx_id=ctx_id, input_size=(640, 640))
    _detector_cache = det
    logger.info("InsightFace ONNX detector loaded from %s  (ctx_id=%d)", det_path, ctx_id)
    return det


def _detect_faces(img_bgr: np.ndarray) -> dict:
    """
    Detect faces in a BGR image using InsightFace's ONNX detector.

    Returns a dict compatible with the original RetinaFace.detect_faces() format:
      {
        "face_1": {
          "score": float,
          "facial_area": (x1, y1, x2, y2),
          "landmarks": {"left_eye": (x, y), "right_eye": (x, y)}
        }, ...
      }
    Returns {} when no face is found.
    """
    det = _get_detector()
    bboxes, kps = det.detect(img_bgr)

    if bboxes is None or len(bboxes) == 0:
        return {}

    faces: dict = {}
    for i, (bbox, kp) in enumerate(zip(bboxes, kps)):
        x1, y1, x2, y2, score = bbox
        faces[f"face_{i + 1}"] = {
            "score":       float(score),
            "facial_area": (int(x1), int(y1), int(x2), int(y2)),
            "landmarks": {
                # kp[0] = person's RIGHT eye (smaller x, viewer's left)
                # kp[1] = person's LEFT eye  (larger x,  viewer's right)
                # This matches retina-face's "right_eye"/"left_eye" convention,
                # keeping the alignment angle ≈180° so ROTATE_180 corrects it.
                "right_eye": (float(kp[0][0]), float(kp[0][1])),
                "left_eye":  (float(kp[1][0]), float(kp[1][1])),
            },
        }

    return faces


# ─── Utility ──────────────────────────────────────────────────────────────────

def _l2_normalize(x: np.ndarray, eps: float = 1e-10) -> np.ndarray:
    """L2-normalize an array along the last axis. Returns float32."""
    x = np.asarray(x, dtype=np.float32)
    norm = np.linalg.norm(x, axis=-1, keepdims=True)
    return x / np.maximum(norm, eps)


def _flatten_embedding(emb) -> np.ndarray:
    """
    Flatten nested embedding artefacts such as [[...]] produced by some
    InsightFace model versions and ensure shape (D,) float32.
    """
    emb = np.asarray(emb, dtype=np.float32)
    while emb.ndim > 1:
        emb = emb[0]
    return emb


# ─── InsightFace model loader ─────────────────────────────────────────────────

def load_insightface_model(model_path: str):
    """
    Load the InsightFace recognition model (buffalo_l w600k_r50.onnx).

    Parameters
    ----------
    model_path : str
        Absolute path to the .onnx weight file.

    Returns
    -------
    Loaded InsightFace recognition model with `.get_feat(img_rgb)` callable.

    Raises
    ------
    FileNotFoundError  if the .onnx file is absent.
    ImportError        if insightface / onnxruntime are not installed.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"InsightFace ONNX model not found: {model_path}\n"
            "Download buffalo_l:\n"
            "  python -c \"import insightface; "
            "insightface.app.FaceAnalysis('buffalo_l').prepare(ctx_id=-1)\""
        )

    import insightface  # type: ignore
    import onnxruntime as ort  # type: ignore

    # Use GPU (ctx_id=0) only when an accelerated ONNX provider is available
    providers = ort.get_available_providers()
    ctx_id = 0 if any(p != "CPUExecutionProvider" for p in providers) else -1

    model = insightface.model_zoo.get_model(model_path)
    model.prepare(ctx_id=ctx_id)
    logger.info(
        "InsightFace model loaded from %s  (ctx_id=%d, providers=%s)",
        model_path, ctx_id, providers,
    )
    return model


# ─── Gallery index builder ────────────────────────────────────────────────────

def load_gallery_index(
    gallery_json: str,
    aligned_faces_root: Optional[str] = None,
) -> Tuple:
    """
    Parse gallery embeddings JSON and build a FAISS IndexFlatIP.

    The JSON must be a list of objects with keys:
      "main_photo_name", "face_name", "embedding"

    ``aligned_faces_root`` is *optional*. When supplied, the function tries to
    resolve each aligned-face crop path and stores it in meta for display.
    Entries are NOT skipped if the aligned file is missing — the FAISS index is
    built from every valid embedding in the JSON regardless of disk state.

    Returns
    -------
    (index, meta, matrix)
      index  : faiss.IndexFlatIP  — inner-product (cosine for L2-normalised)
      meta   : list[dict]         — main_photo_name, face_name,
                                    aligned_face_path (str | None)
      matrix : np.ndarray         — shape (N, D) float32, L2-normalised rows
    """
    import faiss  # type: ignore

    if not os.path.exists(gallery_json):
        raise FileNotFoundError(f"Gallery JSON not found: {gallery_json}")

    with open(gallery_json, "r", encoding="utf-8") as fh:
        raw = json.load(fh)

    if not isinstance(raw, list) or len(raw) == 0:
        raise ValueError("Gallery JSON is empty or not a list.")

    gallery_vecs: List[np.ndarray] = []
    meta: List[dict] = []

    for item in raw:
        emb = item.get("embedding")
        main_photo = item.get("main_photo_name", "unknown")
        face_name  = item.get("face_name", "unknown")

        if emb is None:
            continue

        emb = _flatten_embedding(emb)
        emb = _l2_normalize(emb)

        # Try to resolve aligned face path — but never skip because it's absent.
        aligned_path: Optional[str] = None
        if aligned_faces_root:
            candidate = os.path.join(aligned_faces_root, main_photo, face_name)
            if os.path.exists(candidate):
                aligned_path = candidate

        gallery_vecs.append(emb)
        meta.append(
            {
                "main_photo_name":   main_photo,
                "face_name":         face_name,
                "aligned_face_path": aligned_path,  # None if crop not on disk
            }
        )

    if not gallery_vecs:
        raise ValueError(
            "Gallery JSON contains no entries with a valid 'embedding' field."
        )

    matrix = np.vstack(gallery_vecs).astype(np.float32)  # (N, D)
    D = matrix.shape[1]

    index = faiss.IndexFlatIP(D)
    index.add(matrix)

    logger.info(
        "Gallery FAISS index ready: %d faces, embedding dim=%d", len(meta), D
    )
    return index, meta, matrix


# ─── On-the-fly selfie embedding ─────────────────────────────────────────────

def embed_selfie(pil_image: Image.Image, insightface_model) -> np.ndarray:
    """
    Detect the primary face in pil_image using RetinaFace, align it to
    112×112 with eye-based rotation, then embed with InsightFace.

    Parameters
    ----------
    pil_image         : PIL.Image  (any size / mode; will be converted to RGB)
    insightface_model : model from load_insightface_model()

    Returns
    -------
    np.ndarray  shape (D,) float32, L2-normalised.

    Raises
    ------
    RuntimeError  if no face is detected in the image.
    ImportError   if retinaface is not installed.
    """
    img_rgb = np.array(pil_image.convert("RGB"))
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    faces = _detect_faces(img_bgr)

    if not faces:
        raise RuntimeError(
            "No face detected in the uploaded selfie. "
            "Please use a clear, well-lit photo with a visible face."
        )

    # Pick the highest-confidence face
    face_key = max(faces, key=lambda k: faces[k].get("score", 0.0))
    face = faces[face_key]

    h, w = img_bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in face["facial_area"]]

    # Guard against degenerate (zero-area) bounding boxes
    if x2 <= x1 or y2 <= y1:
        raise RuntimeError(
            "Detected face bounding box is degenerate (zero area). "
            "Please use a larger or clearer selfie."
        )

    # 30 % padding — must match the padding used when gallery embeddings were built
    pw = max(1, int((x2 - x1) * 0.30))
    ph = max(1, int((y2 - y1) * 0.30))
    x1c = max(0, x1 - pw)
    y1c = max(0, y1 - ph)
    x2c = min(w, x2 + pw)
    y2c = min(h, y2 + ph)

    crop_bgr = img_bgr[y1c:y2c, x1c:x2c]

    # ── Eye-based alignment (skipped gracefully if landmarks are absent) ──────
    try:
        lm = face["landmarks"]
        left_eye  = np.array(lm["left_eye"],  dtype=np.float32)
        right_eye = np.array(lm["right_eye"], dtype=np.float32)

        # Convert global landmark coords to crop-local coords
        origin  = np.array([x1c, y1c], dtype=np.float32)
        le_crop = left_eye  - origin
        re_crop = right_eye - origin

        dx = re_crop[0] - le_crop[0]
        dy = re_crop[1] - le_crop[1]
        angle       = float(np.degrees(np.arctan2(dy, dx)))
        eyes_center = tuple(((le_crop + re_crop) / 2.0).tolist())

        M   = cv2.getRotationMatrix2D(eyes_center, angle, scale=1.0)
        ch, cw = crop_bgr.shape[:2]
        aligned = cv2.warpAffine(crop_bgr, M, (cw, ch), flags=cv2.INTER_CUBIC)
    except (KeyError, TypeError, cv2.error) as exc:
        logger.warning(
            "Eye-alignment skipped (landmark error: %s); using raw crop.", exc
        )
        aligned = crop_bgr

    # Resize to canonical InsightFace input size
    aligned_112 = cv2.resize(aligned, (112, 112), interpolation=cv2.INTER_AREA)

    # ── 180° rotation — gallery embeddings were built with this same rotation ─
    # The notebook pipeline applied cv2.ROTATE_180 to every aligned face before
    # calling model.get_feat().  We must do the same so the selfie embedding is
    # in the same space as the gallery embeddings.
    aligned_112 = cv2.rotate(aligned_112, cv2.ROTATE_180)

    # Convert BGR → RGB for the model
    aligned_rgb = cv2.cvtColor(aligned_112, cv2.COLOR_BGR2RGB)

    emb = insightface_model.get_feat(aligned_rgb)
    emb = _flatten_embedding(emb)
    emb = _l2_normalize(emb)

    logger.info("Selfie embedded: shape=%s, norm=%.4f", emb.shape, np.linalg.norm(emb))
    return emb


# ─── Embed face from YOLO crop (for Mode B re-verification) ────────────────

def embed_face_from_crop(
    pil_image: Image.Image,
    insightface_model,
) -> Optional[np.ndarray]:
    """
    Detect the primary face in a person crop (from YOLO) and embed it.
    Returns L2-normalized (D,) float32 embedding, or None if no face found.
    Unlike embed_selfie(), does NOT raise — returns None on failure so callers
    can filter silently.

    Parameters
    ----------
    pil_image         : PIL.Image  (any size / mode; will be converted to RGB)
    insightface_model : model from load_insightface_model()

    Returns
    -------
    np.ndarray  shape (D,) float32, L2-normalised, or None if no face detected.
    """
    img_rgb = np.array(pil_image.convert("RGB"))
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    faces = _detect_faces(img_bgr)
    if not faces:
        return None

    # Pick the highest-confidence face
    face_key = max(faces, key=lambda k: faces[k].get("score", 0.0))
    face = faces[face_key]

    h, w = img_bgr.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in face["facial_area"]]

    # Guard against degenerate (zero-area) bounding boxes
    if x2 <= x1 or y2 <= y1:
        return None

    # 30% padding — matches the padding used in embed_selfie()
    pw = max(1, int((x2 - x1) * 0.30))
    ph = max(1, int((y2 - y1) * 0.30))
    x1c = max(0, x1 - pw)
    y1c = max(0, y1 - ph)
    x2c = min(w, x2 + pw)
    y2c = min(h, y2 + ph)

    crop_bgr = img_bgr[y1c:y2c, x1c:x2c]

    # ── Eye-based alignment (skipped gracefully if landmarks are absent) ──────
    try:
        lm = face["landmarks"]
        left_eye  = np.array(lm["left_eye"],  dtype=np.float32)
        right_eye = np.array(lm["right_eye"], dtype=np.float32)

        # Convert global landmark coords to crop-local coords
        origin  = np.array([x1c, y1c], dtype=np.float32)
        le_crop = left_eye  - origin
        re_crop = right_eye - origin

        dx = re_crop[0] - le_crop[0]
        dy = re_crop[1] - le_crop[1]
        angle       = float(np.degrees(np.arctan2(dy, dx)))
        eyes_center = tuple(((le_crop + re_crop) / 2.0).tolist())

        M   = cv2.getRotationMatrix2D(eyes_center, angle, scale=1.0)
        ch, cw = crop_bgr.shape[:2]
        aligned = cv2.warpAffine(crop_bgr, M, (cw, ch), flags=cv2.INTER_CUBIC)
    except (KeyError, TypeError, cv2.error):
        aligned = crop_bgr

    # Resize to canonical InsightFace input size
    aligned_112 = cv2.resize(aligned, (112, 112), interpolation=cv2.INTER_AREA)

    # 180° rotation — matches embed_selfie() and gallery embedding pipeline
    aligned_112 = cv2.rotate(aligned_112, cv2.ROTATE_180)

    # Convert BGR → RGB for the model
    aligned_rgb = cv2.cvtColor(aligned_112, cv2.COLOR_BGR2RGB)

    emb = insightface_model.get_feat(aligned_rgb)
    emb = _flatten_embedding(emb)
    emb = _l2_normalize(emb)

    return emb


def face_recheck_score(selfie_emb: np.ndarray, crop_emb: np.ndarray) -> float:
    """
    Compute combined face similarity score between two L2-normalised embeddings.

    Formula: 0.8 × cosine + 0.2 × exp(−0.5 × L2)

    This reuses the same scoring formula as search_gallery() for consistency.

    Parameters
    ----------
    selfie_emb : np.ndarray  shape (D,) — L2-normalised selfie embedding
    crop_emb   : np.ndarray  shape (D,) — L2-normalised crop embedding

    Returns
    -------
    float  combined score in range roughly [0, 1]
    """
    cos = float(np.dot(selfie_emb, crop_emb))
    l2  = float(np.linalg.norm(selfie_emb - crop_emb))
    return 0.8 * cos + 0.2 * float(np.exp(-0.5 * l2))


# ─── FAISS search with combined scoring ──────────────────────────────────────

def search_gallery(
    selfie_emb: np.ndarray,
    index,
    meta: List[dict],
    matrix: np.ndarray,
    threshold: float = 0.29,
    top_n: int = 50,
) -> Tuple[List[dict], np.ndarray]:
    """
    Search the FAISS gallery index and return up to top_n ranked results.

    Combined score = 0.8 × cosine + 0.2 × exp(−0.5 × L2)

    Results below `threshold` are flagged `low_confidence=True` so the
    caller can show a UI warning without hiding any results.

    Parameters
    ----------
    selfie_emb : np.ndarray  shape (D,) — L2-normalised selfie embedding
    index      : faiss.IndexFlatIP
    meta       : list[dict]  — gallery metadata (from load_gallery_index)
    matrix     : np.ndarray  shape (N, D) — gallery matrix (from load_gallery_index)
    threshold  : float       — combined score below which result is "low confidence"
    top_n      : int         — max results to return

    Returns
    -------
    (list[dict], np.ndarray)
      results : sorted by combined_score descending, each containing:
                rank, main_photo_name, face_name, aligned_face_path,
                cosine, l2_distance, combined_score, low_confidence
      proto_vec : (D,) refined prototype embedding (from refinement cycles or original selfie)
    """
    # ---------------- Notebook-matching prototype refinement ----------------
    # The logic below mirrors the refinement loop used in `vibhu.ipynb`:
    # - TIER1_THRESHOLD = 0.30
    # - TIER2_THRESHOLD = 0.50
    # - NUM_CYCLES = 3
    # - Combined score: 0.8*cos + 0.2*exp(-0.5*l2)
    TIER1_THRESHOLD = 0.440
    TIER2_THRESHOLD = 0.50
    NUM_CYCLES = 3

    q = selfie_emb.reshape(1, -1).astype(np.float32)
    q = _l2_normalize(q)  # (1, D)

    D_gallery = matrix.shape[1]
    if q.shape[1] != D_gallery:
        raise ValueError(
            f"Embedding dimension mismatch: selfie has {q.shape[1]}, "
            f"gallery has {D_gallery}."
        )

    N = len(meta)
    k = min(top_n, N)
    if k == 0:
        return []

    def _compute_combined_for_proto(proto_vec_1d: np.ndarray):
        # proto_vec_1d: (D,)
        cos_all = matrix @ proto_vec_1d  # (N,)
        l2_all = np.linalg.norm(matrix - proto_vec_1d.reshape(1, -1), axis=1)  # (N,)
        combined_all = 0.8 * cos_all + 0.2 * np.exp(-0.5 * l2_all)
        return cos_all.astype(np.float32), l2_all.astype(np.float32), combined_all.astype(np.float32)

    # Initial stage (selfie)
    selfie_vec = q.reshape(-1)  # (D,)
    cos_init, l2_init, combined_init = _compute_combined_for_proto(selfie_vec)

    tier1_indices = np.where(combined_init >= TIER1_THRESHOLD)[0].astype(int)
    high_conf_indices: set[int] = set(tier1_indices.tolist())

    tier1_candidates: List[dict] = []
    for idx in tier1_indices.tolist():
        tier1_candidates.append(
            {
                "gallery_idx": idx,
                "main_photo_name": meta[idx]["main_photo_name"],
                "face_name": meta[idx]["face_name"],
                "aligned_face_path": meta[idx]["aligned_face_path"],
                "cosine": float(cos_init[idx]),
                "l2_distance": float(l2_init[idx]),
                "combined_score": float(combined_init[idx]),
                "tier": 1,
            }
        )

    # If nothing passes TIER1 in the initial stage, fall back to the best
    # combined scores so the UI always shows something.
    if not high_conf_indices:
        # Sort by combined score and return top_k.
        top_idx = np.argsort(combined_init)[::-1][:k].astype(int)
        results: List[dict] = []
        for rank_i, gal_idx in enumerate(top_idx, start=1):
            combined = float(combined_init[gal_idx])
            results.append(
                {
                    "rank": rank_i,
                    "gallery_idx": int(gal_idx),
                    "main_photo_name": meta[int(gal_idx)]["main_photo_name"],
                    "face_name": meta[int(gal_idx)]["face_name"],
                    "aligned_face_path": meta[int(gal_idx)]["aligned_face_path"],
                    "cosine": round(float(cos_init[gal_idx]), 4),
                    "l2_distance": round(float(l2_init[gal_idx]), 4),
                    "combined_score": round(combined, 4),
                    "low_confidence": combined < threshold,
                }
            )
        logger.info(
            "Gallery search complete (fallback): %d results, top score=%.4f",
            len(results),
            results[0]["combined_score"] if results else 0.0,
        )
        return results, selfie_vec  # Return original selfie as proto in fallback

    # Refinement cycles: build prototype from current high_conf set and
    # expand with any indices that still meet TIER1_THRESHOLD.
    current_best_proto_1d: Optional[np.ndarray] = None
    for _cycle in range(1, NUM_CYCLES + 1):
        if not high_conf_indices:
            break

        current_indices = np.fromiter(high_conf_indices, dtype=int)
        high_conf_embs = matrix[current_indices]  # (M, D)
        proto_vec = np.mean(high_conf_embs, axis=0).astype(np.float32)  # (D,)
        proto_vec = _l2_normalize(proto_vec.reshape(1, -1)).reshape(-1)  # (D,)
        current_best_proto_1d = proto_vec

        cos_proto, l2_proto, combined_proto = _compute_combined_for_proto(proto_vec)
        newly = np.where(combined_proto >= TIER1_THRESHOLD)[0].astype(int)
        newly_set = set(newly.tolist()) - high_conf_indices
        high_conf_indices |= newly_set

        if len(newly_set) == 0:
            break

    # Final step: score against the best prototype and take Tier-2 candidates.
    if current_best_proto_1d is None:
        # Shouldn't happen because we already have tier1_indices, but keep safe.
        tier1_candidates.sort(key=lambda x: x["combined_score"], reverse=True)
        final_matches = tier1_candidates
    else:
        cos_final, l2_final, combined_final = _compute_combined_for_proto(current_best_proto_1d)

        tier1_idx_set = {c["gallery_idx"] for c in tier1_candidates}
        tier2_indices = np.where(combined_final >= TIER2_THRESHOLD)[0].astype(int)

        tier2_candidates: List[dict] = []
        for idx in tier2_indices.tolist():
            if idx in tier1_idx_set:
                continue
            tier2_candidates.append(
                {
                    "gallery_idx": idx,
                    "main_photo_name": meta[idx]["main_photo_name"],
                    "face_name": meta[idx]["face_name"],
                    "aligned_face_path": meta[idx]["aligned_face_path"],
                    "cosine": float(cos_final[idx]),
                    "l2_distance": float(l2_final[idx]),
                    "combined_score": float(combined_final[idx]),
                    "tier": 2,
                }
            )

        tier1_candidates.sort(key=lambda x: x["combined_score"], reverse=True)
        tier2_candidates.sort(key=lambda x: x["combined_score"], reverse=True)
        final_matches = tier1_candidates + tier2_candidates

    final_matches = final_matches[:k]

    results: List[dict] = []
    for rank_i, m in enumerate(final_matches, start=1):
        combined = float(m["combined_score"])
        results.append(
            {
                "rank": rank_i,
                "gallery_idx": int(m["gallery_idx"]),
                "main_photo_name": m["main_photo_name"],
                "face_name": m["face_name"],
                "aligned_face_path": m["aligned_face_path"],
                "cosine": round(float(m["cosine"]), 4),
                "l2_distance": round(float(m["l2_distance"]), 4),
                "combined_score": round(combined, 4),
                "low_confidence": combined < threshold,
            }
        )

    logger.info(
        "Gallery search complete (prototype refinement): %d results, top score=%.4f",
        len(results),
        results[0]["combined_score"] if results else 0.0,
    )
    return results, current_best_proto_1d if current_best_proto_1d is not None else selfie_vec
