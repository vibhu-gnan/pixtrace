/**
 * Image URL utilities
 *
 * Generates time-limited presigned URLs for images stored in the private R2 bucket.
 * Falls back to preview variant (1200x1200 WebP) when available.
 *
 * All functions are async because URL signing uses HMAC (local, ~0.1ms per URL).
 * URLs expire after 4 hours by default.
 */

import { getSignedR2Url } from './r2-client';

/**
 * Get the original (full resolution) image URL via presigned URL
 */
export async function getOriginalUrl(r2Key: string): Promise<string> {
  return getSignedR2Url(r2Key);
}

/**
 * Get thumbnail URL (for grid display)
 * Uses the preview variant if available, falls back to original
 */
export async function getThumbnailUrl(
  r2Key: string,
  _size: number = 200,
  previewR2Key?: string | null,
): Promise<string> {
  if (previewR2Key) {
    return getSignedR2Url(previewR2Key);
  }
  return getSignedR2Url(r2Key);
}

/**
 * Get preview URL (for lightbox view)
 * Uses pre-computed 1200x1200 WebP variant if available, falls back to original
 */
export async function getPreviewUrl(
  r2Key: string,
  previewR2Key?: string | null,
): Promise<string> {
  if (previewR2Key) {
    return getSignedR2Url(previewR2Key);
  }
  return getSignedR2Url(r2Key);
}

/**
 * Get blur placeholder URL (for progressive loading)
 * Uses preview variant as placeholder
 */
export async function getBlurPlaceholderUrl(
  r2Key: string,
  previewR2Key?: string | null,
): Promise<string> {
  return getThumbnailUrl(r2Key, 200, previewR2Key);
}
