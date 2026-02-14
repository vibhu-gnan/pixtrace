export interface ImageVariants {
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

  const [preview] = await Promise.all([
    createContainFit(img, 1200, 1200, 0.80),
  ]);

  return { preview };
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
