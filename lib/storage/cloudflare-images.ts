/**
 * Image URL utilities
 *
 * Supports two modes:
 * 1. Cloudflare Image Resizing (if zone is on a paid Cloudflare plan with Image Resizing enabled)
 *    URL format: {your-domain}/cdn-cgi/image/{transforms}/{origin-url}
 * 2. Direct R2 public URL fallback (no transformations, serves original)
 *
 * NOTE: Cloudflare Images (imagedelivery.net) requires a separate upload API
 *       and cannot serve R2 objects directly. If CLOUDFLARE_IMAGES_DELIVERY_URL
 *       points to imagedelivery.net, we fall back to direct R2 URLs.
 */

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  quality?: number; // 1-100
  format?: 'auto' | 'webp' | 'avif' | 'json' | 'jpeg' | 'png';
  blur?: number; // 1-250
  sharpen?: number; // 0-10
}

/**
 * Get the base R2 public URL for an object
 */
function getR2DirectUrl(r2Key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
  return `${publicUrl}/${r2Key}`;
}

/**
 * Check if Cloudflare Image Resizing is available
 * Image Resizing uses /cdn-cgi/image/ on your own domain (not imagedelivery.net)
 */
function hasImageResizing(): boolean {
  const url = process.env.CLOUDFLARE_IMAGE_RESIZING_URL;
  return !!url && !url.includes('imagedelivery.net');
}

/**
 * Generate image URL with optional Cloudflare Image Resizing transformations
 * Falls back to direct R2 URL if resizing isn't configured
 */
export function getCloudflareImageUrl(
  r2Key: string,
  options: ImageTransformOptions = {}
): string {
  // Always fall back to direct R2 URL if Image Resizing isn't available
  if (!hasImageResizing()) {
    return getR2DirectUrl(r2Key);
  }

  const {
    width,
    height,
    fit = 'cover',
    gravity = 'auto',
    quality = 85,
    format = 'auto',
    blur,
    sharpen,
  } = options;

  // Build transformation string
  const transforms: string[] = [];
  if (width) transforms.push(`width=${width}`);
  if (height) transforms.push(`height=${height}`);
  transforms.push(`fit=${fit}`);
  transforms.push(`gravity=${gravity}`);
  transforms.push(`quality=${quality}`);
  transforms.push(`format=${format}`);
  if (blur) transforms.push(`blur=${blur}`);
  if (sharpen) transforms.push(`sharpen=${sharpen}`);

  const transformString = transforms.join(',');
  const originUrl = getR2DirectUrl(r2Key);

  // Cloudflare Image Resizing URL format:
  // {your-domain}/cdn-cgi/image/{transforms}/{origin-image-url}
  return `${process.env.CLOUDFLARE_IMAGE_RESIZING_URL}/cdn-cgi/image/${transformString}/${originUrl}`;
}

/**
 * Generate responsive image srcset for different screen sizes
 */
export function getResponsiveImageSrcSet(r2Key: string): string {
  const widths = [320, 640, 768, 1024, 1280, 1536];
  const srcset = widths.map(width => {
    const url = getCloudflareImageUrl(r2Key, { width, format: 'auto' });
    return `${url} ${width}w`;
  });
  return srcset.join(', ');
}

/**
 * Generate thumbnail URL (for grid display)
 */
export function getThumbnailUrl(r2Key: string, size: number = 200): string {
  return getCloudflareImageUrl(r2Key, {
    width: size,
    height: size,
    fit: 'cover',
    format: 'auto',
    quality: 75,
  });
}

/**
 * Generate preview/lightbox URL (full image view)
 */
export function getPreviewUrl(r2Key: string): string {
  return getCloudflareImageUrl(r2Key, {
    width: 1200,
    height: 1200,
    fit: 'contain',
    format: 'auto',
    quality: 80,
  });
}

/**
 * Generate blur placeholder URL (for progressive loading)
 */
export function getBlurPlaceholderUrl(r2Key: string): string {
  return getCloudflareImageUrl(r2Key, {
    width: 40,
    quality: 50,
    blur: 20,
    format: 'webp',
  });
}

