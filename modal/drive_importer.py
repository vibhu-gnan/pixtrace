"""
PIXTRACE Google Drive Import Pipeline — Modal Server

Single CPU class:
  DriveImporter:
    POST /import-folder  — Download photos from Drive, generate variants, upload to R2

Supports two import modes:
  - flat: All photos go into one album
  - folder_to_album: Each Drive subfolder becomes a separate album
"""

import modal
import os
import io
import re
import time
import hashlib
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Modal app definition
# ---------------------------------------------------------------------------

drive_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "Pillow>=10.0",
        "pillow-heif>=0.16",
        "boto3>=1.34",
        "supabase>=2.0",
        "requests>=2.31",
        "fastapi[standard]",
    )
)

app = modal.App("pixtrace-drive-importer")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

THUMB_SIZE = (200, 200)
PREVIEW_MAX = (1200, 1200)
THUMB_QUALITY = 80
PREVIEW_QUALITY = 85
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
BATCH_SIZE = 50  # Flush media records every N files
CANCEL_CHECK_INTERVAL = 10  # Check cancellation every N files
DOWNLOAD_DELAY = 0.1  # 100ms between Drive downloads
MAX_DOWNLOAD_RETRIES = 5
DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"

IMPORTABLE_MIMES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "image/heic", "image/heif", "image/tiff", "image/bmp",
}


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def sanitize_filename(name: str) -> str:
    """Sanitize filename for R2 keys (matches TS implementation)."""
    return re.sub(r"[^a-zA-Z0-9._-]", "_", name)


def timing_safe_equal(a: str, b: str) -> bool:
    """Constant-time string comparison."""
    import hmac
    return hmac.compare_digest(a.encode(), b.encode())


# ---------------------------------------------------------------------------
# Drive API helpers
# ---------------------------------------------------------------------------

def drive_api_get(path: str, api_key: str, stream: bool = False):
    """Make an authenticated Drive API request with retry on rate limits."""
    import requests as http

    url = f"{DRIVE_API_BASE}{path}"
    sep = "&" if "?" in path else "?"
    url = f"{url}{sep}key={api_key}"

    for attempt in range(MAX_DOWNLOAD_RETRIES):
        resp = http.get(url, stream=stream, timeout=60)

        if resp.status_code == 200:
            return resp

        if resp.status_code in (403, 429):
            # Rate limited — exponential backoff
            wait = min(2 ** (attempt + 1), 32)
            print(f"[Drive] Rate limited ({resp.status_code}), waiting {wait}s...")
            time.sleep(wait)
            continue

        if resp.status_code == 404:
            raise FileNotFoundError(f"Drive file not found: {path}")

        resp.raise_for_status()

    raise Exception(f"Drive API failed after {MAX_DOWNLOAD_RETRIES} retries")


def list_folder_recursive(folder_id: str, api_key: str, path: str = ""):
    """
    Recursively list all image files in a Drive folder.
    Returns list of dicts: { id, name, mime_type, size, folder_path }
    """
    import requests as http

    all_files = []
    page_token = None

    while True:
        query = f"'{folder_id}' in parents and trashed = false"
        fields = "files(id,name,mimeType,size),nextPageToken"
        url = f"/files?q={query}&fields={fields}&pageSize=1000"
        if page_token:
            url += f"&pageToken={page_token}"

        # URL-encode the query parameter properly
        import urllib.parse
        encoded_q = urllib.parse.quote(query)
        encoded_fields = urllib.parse.quote(fields)
        url = f"/files?q={encoded_q}&fields={encoded_fields}&pageSize=1000"
        if page_token:
            url += f"&pageToken={page_token}"

        resp = drive_api_get(url, api_key)
        data = resp.json()

        for f in data.get("files", []):
            if f["mimeType"] == "application/vnd.google-apps.folder":
                sub_path = f"{path}/{f['name']}" if path else f["name"]
                sub_files = list_folder_recursive(f["id"], api_key, sub_path)
                all_files.extend(sub_files)
            elif f["mimeType"] in IMPORTABLE_MIMES:
                all_files.append({
                    "id": f["id"],
                    "name": f["name"],
                    "mime_type": f["mimeType"],
                    "size": int(f.get("size", 0)),
                    "folder_path": path,
                })

        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return all_files


# ---------------------------------------------------------------------------
# Image processing
# ---------------------------------------------------------------------------

def process_image(image_bytes: bytes):
    """
    Process image: EXIF transpose, generate thumbnail + preview.
    Returns (original_bytes, thumb_bytes, preview_bytes, width, height).
    """
    from PIL import Image, ImageOps

    # Register HEIF opener if available
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass

    img = Image.open(io.BytesIO(image_bytes))

    # Apply EXIF orientation
    img = ImageOps.exif_transpose(img)

    # Convert to RGB if necessary (e.g., RGBA, P mode)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    width, height = img.size

    # --- Thumbnail (200x200 center-crop) ---
    thumb = img.copy()
    # Calculate center crop for square aspect
    min_dim = min(width, height)
    left = (width - min_dim) // 2
    top = (height - min_dim) // 2
    thumb = thumb.crop((left, top, left + min_dim, top + min_dim))
    thumb = thumb.resize(THUMB_SIZE, Image.LANCZOS)

    thumb_buf = io.BytesIO()
    thumb.save(thumb_buf, format="WEBP", quality=THUMB_QUALITY)
    thumb_bytes = thumb_buf.getvalue()

    # --- Preview (1200x1200 contain-fit) ---
    preview = ImageOps.contain(img, PREVIEW_MAX, method=Image.LANCZOS)

    preview_buf = io.BytesIO()
    preview.save(preview_buf, format="WEBP", quality=PREVIEW_QUALITY)
    preview_bytes = preview_buf.getvalue()

    return image_bytes, thumb_bytes, preview_bytes, width, height


# ---------------------------------------------------------------------------
# R2 upload helpers
# ---------------------------------------------------------------------------

def upload_to_r2(s3_client, bucket: str, key: str, data: bytes, content_type: str):
    """Upload bytes to R2 with retry."""
    for attempt in range(3):
        try:
            s3_client.put_object(
                Bucket=bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
            return
        except Exception as e:
            if attempt == 2:
                raise
            print(f"[R2] Upload retry {attempt + 1} for {key}: {e}")
            time.sleep(1)


# ---------------------------------------------------------------------------
# Modal class
# ---------------------------------------------------------------------------

@app.cls(
    image=drive_image,
    cpu=2,
    memory=2048,
    timeout=7200,  # 2 hours max
    scaledown_window=120,
    secrets=[modal.Secret.from_name("pixtrace-env")],
)
class DriveImporter:

    @modal.enter()
    def setup(self):
        """Initialize clients on container start."""
        import boto3

        self.api_key = os.environ["GOOGLE_DRIVE_API_KEY"]

        # R2 (S3-compatible) client
        self.s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
        )
        self.bucket = os.environ["R2_BUCKET_NAME"]

        # Supabase client (service_role for direct writes)
        from supabase import create_client
        self.supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )

    def _update_job(self, job_id: str, updates: dict):
        """Update import_jobs row."""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        self.supabase.table("import_jobs").update(updates).eq("id", job_id).execute()

    def _is_cancelled(self, job_id: str) -> bool:
        """Check if the job has been cancelled."""
        result = self.supabase.table("import_jobs").select("cancelled").eq("id", job_id).single().execute()
        return result.data.get("cancelled", False) if result.data else False

    def _resolve_albums(self, job_id: str, event_id: str, organizer_id: str,
                        album_id: str | None, import_mode: str,
                        files: list, folder_name: str) -> dict:
        """
        Resolve folder_path → album_id mapping.
        For flat mode: all paths map to the provided album_id.
        For folder_to_album: create an album per unique folder path.
        Returns dict: { folder_path: album_id }
        """
        if import_mode == "flat":
            # All files go to one album
            paths = set(f["folder_path"] for f in files)
            return {p: album_id for p in paths}

        # folder_to_album mode: create albums per unique folder path
        unique_paths = sorted(set(f["folder_path"] for f in files))
        path_to_album = {}

        # Get current max sort_order for this event
        result = self.supabase.table("albums") \
            .select("sort_order") \
            .eq("event_id", event_id) \
            .order("sort_order", desc=True) \
            .limit(1) \
            .execute()
        sort_order = (result.data[0]["sort_order"] if result.data else -1) + 1

        for path in unique_paths:
            # Root folder → use Drive folder name
            album_name = path.split("/")[-1] if path else folder_name

            # Create album
            album_result = self.supabase.table("albums").insert({
                "event_id": event_id,
                "name": album_name,
                "sort_order": sort_order,
            }).execute()

            if album_result.data:
                path_to_album[path] = album_result.data[0]["id"]
                sort_order += 1
            else:
                print(f"[WARN] Failed to create album for path: {path}")

        return path_to_album

    @modal.fastapi_endpoint(method="POST")
    def import_folder(self, request: dict):
        """
        Main import endpoint. Downloads photos from Drive, generates variants,
        uploads to R2, and creates media records.
        """
        import requests as http_requests

        # Verify secret
        expected_secret = os.environ.get("FACE_PROCESSING_SECRET", "")
        if not timing_safe_equal(request.get("secret", ""), expected_secret):
            return {"error": "unauthorized"}, 401

        job_id = request.get("job_id")
        event_id = request.get("event_id")
        organizer_id = request.get("organizer_id")
        album_id = request.get("album_id")  # None for folder_to_album mode
        folder_id = request.get("folder_id")
        import_mode = request.get("import_mode", "flat")

        if not all([job_id, event_id, organizer_id, folder_id]):
            return {"error": "missing required fields"}, 400

        try:
            # ── Phase 1: List files ───────────────────────────
            self._update_job(job_id, {"status": "listing"})

            # Get folder name for album creation
            folder_resp = drive_api_get(f"/files/{folder_id}?fields=name", self.api_key)
            folder_name = folder_resp.json().get("name", "Drive Import")

            files = list_folder_recursive(folder_id, self.api_key)

            if not files:
                self._update_job(job_id, {
                    "status": "completed",
                    "total_files": 0,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                })
                return {"total": 0, "completed": 0, "failed": 0, "skipped": 0}

            self._update_job(job_id, {
                "status": "processing",
                "total_files": len(files),
            })

            # ── Phase 2: Resolve albums ───────────────────────
            path_to_album = self._resolve_albums(
                job_id, event_id, organizer_id,
                album_id, import_mode, files, folder_name,
            )

            # ── Phase 3: Process files ────────────────────────
            completed = 0
            failed = 0
            skipped = 0
            total_bytes = 0
            seen_hashes = set()
            media_batch = []
            created_media_ids = []

            for idx, file_info in enumerate(files):
                # Check cancellation periodically
                if idx > 0 and idx % CANCEL_CHECK_INTERVAL == 0:
                    if self._is_cancelled(job_id):
                        self._update_job(job_id, {
                            "status": "cancelled",
                            "completed": completed,
                            "failed": failed,
                            "skipped": skipped,
                        })
                        return {
                            "total": len(files),
                            "completed": completed,
                            "failed": failed,
                            "skipped": skipped,
                            "cancelled": True,
                        }

                try:
                    # Validate file size
                    if file_info["size"] > MAX_FILE_SIZE:
                        skipped += 1
                        continue

                    # Resolve album for this file
                    target_album = path_to_album.get(file_info["folder_path"])
                    if not target_album:
                        skipped += 1
                        continue

                    # Download from Drive
                    time.sleep(DOWNLOAD_DELAY)
                    resp = drive_api_get(
                        f"/files/{file_info['id']}?alt=media",
                        self.api_key,
                    )
                    image_bytes = resp.content

                    # Duplicate check (MD5)
                    file_hash = hashlib.md5(image_bytes).hexdigest()
                    if file_hash in seen_hashes:
                        skipped += 1
                        continue
                    seen_hashes.add(file_hash)

                    # Process image (EXIF transpose + variants)
                    try:
                        original, thumb, preview, w, h = process_image(image_bytes)
                    except Exception as img_err:
                        print(f"[WARN] Image processing failed for {file_info['name']}: {img_err}")
                        failed += 1
                        continue

                    # Build R2 keys
                    ts = int(time.time() * 1000)
                    safe_name = sanitize_filename(file_info["name"])
                    base_key = f"organizers/{organizer_id}/events/{event_id}/{target_album}/{ts}-{safe_name}"
                    thumb_key = f"{base_key}_thumb.webp"
                    preview_key = f"{base_key}_preview.webp"

                    # Upload to R2 (3 files)
                    upload_to_r2(self.s3, self.bucket, base_key, original, file_info["mime_type"])
                    upload_to_r2(self.s3, self.bucket, thumb_key, thumb, "image/webp")
                    upload_to_r2(self.s3, self.bucket, preview_key, preview, "image/webp")

                    file_total = len(original) + len(thumb) + len(preview)
                    total_bytes += file_total

                    # Accumulate media record
                    media_batch.append({
                        "album_id": target_album,
                        "event_id": event_id,
                        "r2_key": base_key,
                        "original_filename": file_info["name"],
                        "media_type": "image",
                        "mime_type": file_info["mime_type"],
                        "file_size": len(original),
                        "width": w,
                        "height": h,
                        "thumbnail_r2_key": thumb_key,
                        "preview_r2_key": preview_key,
                        "processing_status": "completed",
                    })

                    completed += 1

                    # Flush batch
                    if len(media_batch) >= BATCH_SIZE:
                        inserted = self.supabase.table("media").insert(media_batch).execute()
                        if inserted.data:
                            created_media_ids.extend([r["id"] for r in inserted.data])
                        media_batch = []

                        # Update progress
                        self._update_job(job_id, {
                            "completed": completed,
                            "failed": failed,
                            "skipped": skipped,
                        })

                except FileNotFoundError:
                    skipped += 1
                except Exception as e:
                    print(f"[ERROR] Failed to process {file_info.get('name', '?')}: {e}")
                    failed += 1

            # ── Phase 4: Finalize ─────────────────────────────

            # Flush remaining batch
            if media_batch:
                inserted = self.supabase.table("media").insert(media_batch).execute()
                if inserted.data:
                    created_media_ids.extend([r["id"] for r in inserted.data])

            # Update storage usage
            if total_bytes > 0:
                try:
                    self.supabase.rpc("increment_storage_used", {
                        "org_id": organizer_id,
                        "bytes_to_add": total_bytes,
                    }).execute()
                except Exception as e:
                    print(f"[WARN] Storage tracking failed: {e}")

            # Enqueue face processing jobs (batch insert)
            if created_media_ids:
                face_jobs = [
                    {
                        "event_id": event_id,
                        "media_id": mid,
                        "status": "pending",
                        "attempt_count": 0,
                        "max_attempts": 3,
                    }
                    for mid in created_media_ids
                ]
                # Insert in chunks to avoid payload limits
                for i in range(0, len(face_jobs), 100):
                    chunk = face_jobs[i:i + 100]
                    try:
                        self.supabase.table("face_processing_jobs").insert(chunk).execute()
                    except Exception as e:
                        print(f"[WARN] Face job enqueue failed for chunk {i}: {e}")

                # Fire-and-forget: trigger face processing
                app_url = os.environ.get("NEXT_PUBLIC_APP_URL", "")
                face_secret = os.environ.get("FACE_PROCESSING_SECRET", "")
                if app_url and face_secret:
                    try:
                        http_requests.post(
                            f"{app_url}/api/face/trigger",
                            headers={
                                "Content-Type": "application/json",
                                "X-Face-Secret": face_secret,
                            },
                            timeout=5,
                        )
                    except Exception:
                        pass  # Non-critical

            # Update job as completed
            self._update_job(job_id, {
                "status": "completed",
                "completed": completed,
                "failed": failed,
                "skipped": skipped,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })

            return {
                "total": len(files),
                "completed": completed,
                "failed": failed,
                "skipped": skipped,
            }

        except Exception as e:
            print(f"[FATAL] Import job {job_id} failed: {e}")
            try:
                self._update_job(job_id, {
                    "status": "failed",
                    "error_message": str(e)[:500],
                })
            except Exception:
                pass
            return {"error": str(e)}, 500
