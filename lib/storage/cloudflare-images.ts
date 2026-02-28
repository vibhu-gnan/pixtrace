/**
 * Image URL utilities — Safe wrappers around presigned URL signing.
 *
 * Every function catches signing failures and returns '' instead of crashing.
 * This means one broken image URL never takes down the entire gallery page.
 *
 * All functions are async because URL signing uses HMAC (local, ~0.1ms per URL).
 * URLs expire after 4 hours by default.
 */

import { getSignedR2Url } from './r2-client';

/**
 * Safely sign a URL — returns '' on any error instead of throwing.
 * This isolates individual image failures from crashing the whole page.
 */
async function safeSign(key: string | null | undefined, expiresIn?: number): Promise<string> {
  if (!key) return '';
  try {
    return await getSignedR2Url(key, expiresIn);
  } catch (err) {
    // Already logged by getSignedR2Url — just return empty so caller degrades gracefully
    return '';
  }
}

/**
 * Get the original (full resolution) image URL via presigned URL.
 * Returns '' if signing fails.
 */
export async function getOriginalUrl(r2Key: string): Promise<string> {
  return safeSign(r2Key);
}

/**
 * Get thumbnail URL (for grid display).
 * Uses the preview variant if available, falls back to original.
 * Returns '' if all signing attempts fail.
 */
export async function getThumbnailUrl(
  r2Key: string,
  _size: number = 200,
  previewR2Key?: string | null,
): Promise<string> {
  if (previewR2Key) {
    const url = await safeSign(previewR2Key);
    if (url) return url;
  }
  return safeSign(r2Key);
}

/**
 * Get preview URL (for lightbox view).
 * Uses pre-computed 1200×1200 WebP variant if available, falls back to original.
 * Returns '' if all signing attempts fail.
 */
export async function getPreviewUrl(
  r2Key: string,
  previewR2Key?: string | null,
): Promise<string> {
  if (previewR2Key) {
    const url = await safeSign(previewR2Key);
    if (url) return url;
  }
  return safeSign(r2Key);
}

/**
 * Get blur placeholder URL (for progressive loading).
 * Uses preview variant as placeholder.
 * Returns '' if all signing attempts fail.
 */
export async function getBlurPlaceholderUrl(
  r2Key: string,
  previewR2Key?: string | null,
): Promise<string> {
  return getThumbnailUrl(r2Key, 200, previewR2Key);
}
