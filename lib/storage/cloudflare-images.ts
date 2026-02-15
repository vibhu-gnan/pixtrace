/**
 * Image URL utilities
 *
 * Serves pre-computed preview variants (1200x1200 WebP) from R2.
 * Falls back to original R2 URL when preview is not available
 * (e.g., for older photos uploaded before variant generation was added).
 *
 * Note: Thumbnails are not generated separately — the preview variant
 * is used for grid display, blur placeholders, and lightbox.
 */

/**
 * Get the base R2 public URL for an object
 */
function getR2DirectUrl(r2Key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
  return `${publicUrl}/${r2Key}`;
}

/**
 * Get the original (full resolution) image URL directly from R2
 */
export function getOriginalUrl(r2Key: string): string {
  return getR2DirectUrl(r2Key);
}

/**
 * Get thumbnail URL (for grid display)
 * Uses the preview variant if available, falls back to original
 */
export function getThumbnailUrl(
  r2Key: string,
  _size: number = 200,
  previewR2Key?: string | null,
): string {
  if (previewR2Key) {
    return getR2DirectUrl(previewR2Key);
  }
  return getR2DirectUrl(r2Key);
}

/**
 * Get preview URL (for lightbox view)
 * Uses pre-computed 1200x1200 WebP variant if available, falls back to original
 */
export function getPreviewUrl(
  r2Key: string,
  previewR2Key?: string | null,
): string {
  if (previewR2Key) {
    return getR2DirectUrl(previewR2Key);
  }
  return getR2DirectUrl(r2Key);
}

/**
 * Get blur placeholder URL (for progressive loading)
 * Uses preview variant as placeholder
 */
export function getBlurPlaceholderUrl(
  r2Key: string,
  previewR2Key?: string | null,
): string {
  return getThumbnailUrl(r2Key, 200, previewR2Key);
}
