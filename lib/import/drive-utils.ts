/**
 * Google Drive URL parsing and utility functions.
 */

export interface ParsedDriveUrl {
  folderId: string;
  resourceKey?: string;
}

/**
 * Parse a Google Drive folder URL and extract the folder ID + optional resource key.
 *
 * Supported formats:
 *   https://drive.google.com/drive/folders/{id}
 *   https://drive.google.com/drive/folders/{id}?resourcekey=xxx
 *   https://drive.google.com/drive/u/0/folders/{id}
 *   https://drive.google.com/open?id={id}
 */
export function parseDriveFolderUrl(url: string): ParsedDriveUrl | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const trimmed = url.trim();
    // Ensure it looks like a URL
    const parsed = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    );

    if (
      parsed.hostname !== 'drive.google.com' &&
      parsed.hostname !== 'www.drive.google.com'
    ) {
      return null;
    }

    let folderId: string | null = null;
    let resourceKey: string | undefined;

    // Format: /drive/folders/{id} or /drive/u/N/folders/{id}
    const foldersMatch = parsed.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (foldersMatch) {
      folderId = foldersMatch[1];
    }

    // Format: /open?id={id}
    if (!folderId) {
      const idParam = parsed.searchParams.get('id');
      if (idParam && isValidFolderId(idParam)) {
        folderId = idParam;
      }
    }

    if (!folderId || !isValidFolderId(folderId)) return null;

    // Extract resource key if present
    const rk = parsed.searchParams.get('resourcekey');
    if (rk) {
      resourceKey = rk;
    }

    return { folderId, resourceKey };
  } catch {
    return null;
  }
}

/**
 * Validate a Google Drive folder/file ID.
 * IDs are typically 20-50 chars of alphanumeric, hyphens, underscores.
 */
export function isValidFolderId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,100}$/.test(id);
}

/**
 * Sanitize a filename for use in R2 keys.
 * Matches the pattern in app/api/upload/presigned-url/route.ts.
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Image MIME types we accept for import */
export const IMPORTABLE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
]);

/** Max file size for import (50 MB) */
export const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024;
