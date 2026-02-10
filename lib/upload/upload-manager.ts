import { create } from 'zustand';

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

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      updateItem(id, { status: 'uploading', progress: 0 });

      // Step 1: Get presigned URL
      const presignRes = await fetch('/api/upload/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          albumId,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignRes.ok) {
        throw new Error('Failed to get presigned URL');
      }

      const { url, r2Key } = await presignRes.json();
      updateItem(id, { r2Key, progress: 10 });

      // Step 2: Upload to R2 via presigned URL
      await uploadWithProgress(url, file, file.type, (progress) => {
        updateItem(id, { progress: 10 + progress * 0.8 });
      });

      updateItem(id, { status: 'completing', progress: 90 });

      // Step 3: Create media record
      // Get image dimensions if it's an image
      let width: number | undefined;
      let height: number | undefined;
      if (file.type.startsWith('image/')) {
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
          width,
          height,
        }),
      });

      if (!completeRes.ok) {
        throw new Error('Failed to complete upload');
      }

      updateItem(id, { status: 'done', progress: 100 });
      return; // Success, exit retry loop
    } catch (err: any) {
      if (attempt === MAX_RETRIES - 1) {
        updateItem(id, {
          status: 'error',
          error: err.message || 'Upload failed',
          progress: 0,
        });
      }
      // Wait before retry with exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

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

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.send(file);
  });
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
