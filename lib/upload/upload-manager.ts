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

interface UploadStore {
  items: UploadItem[];
  isUploading: boolean;
  uploadStartedAt: number | null;

  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  startUpload: (eventId: string, albumId: string) => Promise<void>;
  updateItem: (id: string, update: Partial<UploadItem>) => void;
}

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;

export const useUploadStore = create<UploadStore>((set, get) => ({
  items: [],
  isUploading: false,
  uploadStartedAt: null,

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
    set({ items: [], isUploading: false, uploadStartedAt: null });
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
    set({ isUploading: true, uploadStartedAt: Date.now() });

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

      // Step 1: Generate image variants (if applicable) while requesting presigned URLs
      let variantsPromise: Promise<{ preview: Blob } | null> | null = null;
      if (canGenerate) {
        variantsPromise = generateImageVariants(file).catch((err) => {
          console.warn('Variant generation failed, uploading original only:', err);
          return null;
        });
      }

      // Step 2: Get presigned URLs (original + variants if image)
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
        throw new Error(errData.error || 'Failed to get presigned URL');
      }

      const presignData = await presignRes.json();
      const { url, r2Key } = presignData;
      updateItem(id, { r2Key, progress: 5 });

      // Step 3: Upload original to R2 (progress 5-80%)
      await uploadWithProgress(url, file, file.type, (progress) => {
        updateItem(id, { progress: 5 + progress * 0.75 });
      });

      updateItem(id, { progress: 80 });

      // Step 4: Upload variants (progress 80-90%)
      let previewR2Key: string | undefined;
      let variantSizeBytes = 0;

      if (canGenerate && variantsPromise && presignData.variants) {
        const variants = await variantsPromise;
        if (variants) {
          const previewVariant = presignData.variants.find((v: any) => v.suffix === '_preview.webp');

          // Upload preview
          const variantUploads: Promise<void>[] = [];

          if (previewVariant) {
            previewR2Key = previewVariant.r2Key;
            variantSizeBytes += variants.preview.size;
            variantUploads.push(
              uploadBlob(previewVariant.url, variants.preview, 'image/webp')
            );
          }

          await Promise.all(variantUploads);
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
        // Final retry failed
        updateItem(id, {
          status: 'error',
          error: err.message || 'Upload failed',
          progress: 0,
        });
      } else {
        // Will retry - log retry info
        const retryDelay = 1000 * Math.pow(2, attempt);
        console.log(`Retrying upload for ${file.name} in ${retryDelay}ms`);
      }

      // Wait before retry with exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
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
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
