/**
 * Image URL utilities — Safe wrappers around presigned URL signing.
 *
 * Two files per image in R2: original + _preview.webp (1200×1200).
 * Grid shows preview, lightbox shows preview then loads original.
 *
 * Every function catches signing failures and returns '' instead of crashing.
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
 * Get preview URL (1200×1200 WebP) for grid display and lightbox initial view.
 * Falls back to original if preview variant doesn't exist.
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
