export interface ImageVariants {
  thumbnail: Blob; // ~200x200 cover-crop WebP
  preview: Blob;   // max 1200x1200 contain-fit WebP
}

// MIME types that Canvas API can decode
const CANVAS_DECODABLE = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

export function canGenerateVariants(mimeType: string): boolean {
  return CANVAS_DECODABLE.has(mimeType);
}

export async function generateImageVariants(file: File): Promise<ImageVariants> {
  const img = await loadImage(file);

  const [thumbnail, preview] = await Promise.all([
    createCoverCrop(img, 200, 200, 1.0),
    createContainFit(img, 1200, 1200, 0.80),
  ]);

  return { thumbnail, preview };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for variant generation'));
    };
    img.src = url;
  });
}

/**
 * Center-crop to target aspect ratio, then scale down to target dimensions.
 * Used for thumbnails (square crop).
 */
async function createCoverCrop(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  const srcAspect = img.naturalWidth / img.naturalHeight;
  const targetAspect = targetWidth / targetHeight;

  let sx: number, sy: number, sw: number, sh: number;

  if (srcAspect > targetAspect) {
    // Source is wider — crop sides
    sh = img.naturalHeight;
    sw = sh * targetAspect;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    // Source is taller — crop top/bottom
    sw = img.naturalWidth;
    sh = sw / targetAspect;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  return canvasToWebP(canvas, quality);
}

/**
 * Scale down proportionally so neither dimension exceeds max.
 * Used for preview images.
 */
async function createContainFit(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<Blob> {
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Only scale down, never up
  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, 0, 0, width, height);
  return canvasToWebP(canvas, quality);
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate WebP blob'));
        }
      },
      'image/webp',
      quality,
    );
  });
}
