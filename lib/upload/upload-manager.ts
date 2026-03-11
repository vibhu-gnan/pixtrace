import { create } from 'zustand';
import { generateImageVariants, canGenerateVariants } from './image-variants';

export type UploadStatus = 'pending' | 'uploading' | 'completing' | 'done' | 'error';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  r2Key?: string;
  error?: string;
}

export interface StorageLimitInfo {
  storageUsedBytes: number;
  storageLimitBytes: number;
  planName: string;
  planId: string;
  reason: string;
}

interface UploadStore {
  items: UploadItem[];
  isUploading: boolean;
  uploadStartedAt: number | null;
  storageLimitError: StorageLimitInfo | null;

  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  clearStorageLimitError: () => void;
  startUpload: (eventId: string, albumId: string) => Promise<void>;
  updateItem: (id: string, update: Partial<UploadItem>) => void;
}

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;

export const useUploadStore = create<UploadStore>((set, get) => ({
  items: [],
  isUploading: false,
  uploadStartedAt: null,
  storageLimitError: null,

  addFiles: (files: File[]) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'pending',
      progress: 0,
    }));
    set((state) => ({ items: [...state.items, ...newItems] }));
  },

  removeItem: (id: string) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },

  clearCompleted: () => {
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'done'),
    }));
  },

  clearAll: () => {
    set({ items: [], isUploading: false, uploadStartedAt: null, storageLimitError: null });
  },

  clearStorageLimitError: () => {
    set({ storageLimitError: null });
  },

  updateItem: (id: string, update: Partial<UploadItem>) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...update } : item
      ),
    }));
  },

  startUpload: async (eventId: string, albumId: string) => {
    const { items, updateItem } = get();
    const pending = items.filter((item) => item.status === 'pending');

    if (pending.length === 0) return;

    // Pre-flight storage check: verify total size fits within quota BEFORE
    // starting any uploads. This prevents the confusing UX of files failing
    // one-by-one after partial upload.
    const totalSizeBytes = pending.reduce((sum, item) => sum + item.file.size, 0);
    try {
      const res = await fetch('/api/upload/check-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalSizeBytes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.allowed) {
          set({
            storageLimitError: {
              storageUsedBytes: data.storageUsedBytes,
              storageLimitBytes: data.storageLimitBytes,
              planName: data.planName,
              planId: data.planId,
              reason: data.reason,
            },
          });
          return; // Don't start uploading
        }
      }
      // If check-storage fails (network error, etc.), fall through —
      // presigned-url will still enforce server-side
    } catch {
      // Non-critical — server-side check is the real gate
    }

    set({ isUploading: true, uploadStartedAt: Date.now(), storageLimitError: null });

    // Process in batches with concurrency limit
    const queue = [...pending];
    const active: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      const item = queue.shift();
      if (!item) return;

      await uploadSingleFile(item, eventId, albumId, updateItem);

      if (queue.length > 0) {
        await processNext();
      }
    };

    // Start MAX_CONCURRENT uploads
    for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) {
      active.push(processNext());
    }

    await Promise.all(active);
    set({ isUploading: false, uploadStartedAt: null });
  },
}));

async function uploadSingleFile(
  item: UploadItem,
  eventId: string,
  albumId: string,
  updateItem: (id: string, update: Partial<UploadItem>) => void
) {
  const { file, id } = item;
  const isImage = file.type.startsWith('image/');
  const canGenerate = isImage && canGenerateVariants(file.type);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      updateItem(id, { status: 'uploading', progress: 0 });

      // Step 1: Generate preview variant (if applicable) while requesting presigned URLs
      let variantsPromise: Promise<{ preview: Blob } | null> | null = null;
      if (canGenerate) {
        variantsPromise = generateImageVariants(file).catch((err) => {
          console.warn('Variant generation failed, uploading original only:', err);
          return null;
        });
      }

      // Step 2: Get presigned URLs (original + preview if image)
      const presignBody: any = {
        eventId,
        albumId,
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
      };

      if (canGenerate) {
        presignBody.variants = [
          { suffix: '_preview.webp', contentType: 'image/webp' },
        ];
      }

      const presignRes = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presignBody),
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json().catch(() => ({}));
        const errorMsg = errData.error || 'Failed to get presigned URL';

        // If 403 = storage limit hit, stop ALL remaining uploads immediately.
        // No point retrying — every file will fail the same way.
        if (presignRes.status === 403 && errorMsg.includes('Storage limit')) {
          const store = useUploadStore.getState();
          // Mark all remaining pending/uploading items as error
          for (const item of store.items) {
            if (item.status === 'pending' || item.status === 'uploading') {
              store.updateItem(item.id, { status: 'error', error: errorMsg, progress: 0 });
            }
          }
          // Surface the storage limit modal
          useUploadStore.setState({
            storageLimitError: {
              storageUsedBytes: 0,
              storageLimitBytes: 0,
              planName: '',
              planId: '',
              reason: errorMsg,
            },
          });
          throw new Error(errorMsg);
        }

        throw new Error(errorMsg);
      }

      const presignData = await presignRes.json();
      const { url, r2Key } = presignData;
      updateItem(id, { r2Key, progress: 5 });

      // Step 3: Upload original to R2 (progress 5-80%)
      await uploadWithProgress(url, file, file.type, (progress) => {
        updateItem(id, { progress: 5 + progress * 0.75 });
      });

      updateItem(id, { progress: 80 });

      // Step 4: Upload preview variant (progress 80-90%)
      let previewR2Key: string | undefined;
      let variantSizeBytes = 0;

      if (canGenerate && variantsPromise && presignData.variants) {
        const variants = await variantsPromise;
        if (variants) {
          const previewVariant = presignData.variants.find((v: any) => v.suffix === '_preview.webp');

          if (previewVariant) {
            previewR2Key = previewVariant.r2Key;
            variantSizeBytes += variants.preview.size;
            await uploadBlob(previewVariant.url, variants.preview, 'image/webp');
          }
        }
      }

      updateItem(id, { status: 'completing', progress: 90 });

      // Step 5: Get image dimensions and create media record
      let width: number | undefined;
      let height: number | undefined;
      if (isImage) {
        const dims = await getImageDimensions(file);
        width = dims.width;
        height = dims.height;
      }

      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          albumId,
          r2Key,
          originalFilename: file.name,
          mediaType: file.type.startsWith('video/') ? 'video' : 'image',
          mimeType: file.type,
          fileSize: file.size,
          variantSizeBytes,
          width,
          height,
          previewR2Key,
        }),
      });

      if (!completeRes.ok) {
        throw new Error('Failed to complete upload');
      }

      updateItem(id, { status: 'done', progress: 100 });
      return; // Success, exit retry loop
    } catch (err: any) {
      console.error(`Upload attempt ${attempt + 1}/${MAX_RETRIES} failed for ${file.name}:`, err);

      if (attempt === MAX_RETRIES - 1) {
        // Final retry failed — no delay needed, show error immediately
        updateItem(id, {
          status: 'error',
          error: err.message || 'Upload failed',
          progress: 0,
        });
      } else {
        // Wait before retry with exponential backoff
        const retryDelay = 1000 * Math.pow(2, attempt);
        console.log(`Retrying upload for ${file.name} in ${retryDelay}ms`);
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }
}

/**
 * Upload a file with XHR progress tracking (for original files)
 */
function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);

    // Set timeout (30 seconds per MB, minimum 30 seconds)
    const timeoutMs = Math.max(30000, (file.size / (1024 * 1024)) * 30000);
    xhr.timeout = timeoutMs;

    let progressReceived = false;

    // Primary progress handler (uses actual upload progress if available)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        progressReceived = true;
        onProgress(e.loaded / e.total);
      }
    });

    // Fallback progress estimator for when lengthComputable is false
    const startTime = Date.now();
    // Estimate upload speed: 500KB/s (conservative), max duration 60s
    const estimatedDuration = Math.min(file.size / (500 * 1024), 60000);
    const progressInterval = setInterval(() => {
      if (!progressReceived) {
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(0.9, elapsed / estimatedDuration);
        onProgress(estimatedProgress);
      }
    }, 500);

    xhr.addEventListener('load', () => {
      clearInterval(progressInterval);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1); // Mark as complete
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      clearInterval(progressInterval);
      reject(new Error('Upload failed - network error'));
    });

    xhr.addEventListener('abort', () => {
      clearInterval(progressInterval);
      reject(new Error('Upload aborted'));
    });

    xhr.addEventListener('timeout', () => {
      clearInterval(progressInterval);
      reject(new Error(`Upload timeout after ${(timeoutMs / 1000).toFixed(0)}s`));
    });

    xhr.send(file);
  });
}

/**
 * Simple PUT upload for small blobs (variants). No progress tracking needed.
 */
async function uploadBlob(url: string, blob: Blob, contentType: string): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`Variant upload failed with status ${response.status}`);
  }
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      URL.revokeObjectURL(img.src);
      // Treat invalid/zero dimensions as unknown rather than 0×0
      if (w > 0 && h > 0) {
        resolve({ width: w, height: h });
      } else {
        console.warn(`[Upload] Image has invalid dimensions ${w}×${h}: ${file.name}`);
        resolve({ width: 0, height: 0 });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      console.warn(`[Upload] Failed to read image dimensions: ${file.name}`);
      resolve({ width: 0, height: 0 });
    };
    img.src = URL.createObjectURL(file);
  });
}
