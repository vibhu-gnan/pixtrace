/**
 * Client-side presigned URL refresh utility.
 *
 * When presigned URLs expire (4 hours after page load), images fail to load.
 * This utility detects those failures and batch-refreshes URLs via the server,
 * so the gallery self-heals without requiring a full page reload.
 *
 * Features:
 * - Automatic batching: multiple failures within 150ms are grouped into one API call
 * - Deduplication: concurrent requests for the same media ID share one promise
 * - In-memory cache: refreshed URLs are cached to avoid redundant API calls
 * - Max batch size: 50 items per request (server limit)
 * - Single-retry: if refresh fails, the media ID is marked as failed (no infinite loops)
 */

interface RefreshedUrls {
  thumbnail: string;
  preview: string;
  original: string;
}

// ── Module-level state (singleton per page) ──────────────────

/** Cache of already-refreshed URLs (mediaId → urls) */
const urlCache = new Map<string, RefreshedUrls>();

/** Set of media IDs that failed to refresh (don't retry infinitely) */
const failedIds = new Set<string>();

/** Pending batch: media IDs waiting to be flushed */
let batchQueue: {
  mediaId: string;
  resolve: (urls: RefreshedUrls | null) => void;
  reject: (err: Error) => void;
}[] = [];

/** Timer for batching window */
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/** In-flight dedup: if the same mediaId is requested while a batch is pending */
const inflightPromises = new Map<string, Promise<RefreshedUrls | null>>();

// ── Public API ───────────────────────────────────────────────

/**
 * Request fresh presigned URLs for a single media item.
 * Automatically batches with other concurrent requests.
 *
 * @returns Fresh URLs, or null if refresh failed / already failed before
 */
export function refreshMediaUrl(
  eventHash: string,
  mediaId: string,
): Promise<RefreshedUrls | null> {
  // Already refreshed — return from cache
  const cached = urlCache.get(mediaId);
  if (cached) return Promise.resolve(cached);

  // Already failed — don't retry
  if (failedIds.has(mediaId)) return Promise.resolve(null);

  // Already in-flight — dedup
  const inflight = inflightPromises.get(mediaId);
  if (inflight) return inflight;

  // Add to batch
  const promise = new Promise<RefreshedUrls | null>((resolve, reject) => {
    batchQueue.push({ mediaId, resolve, reject });

    // Start or extend the batching window
    if (!batchTimer) {
      batchTimer = setTimeout(() => flushBatch(eventHash), 150);
    }
  });

  inflightPromises.set(mediaId, promise);
  promise.finally(() => inflightPromises.delete(mediaId));

  return promise;
}

/**
 * Clear the refresh cache (e.g., on navigation to a new gallery)
 */
export function clearRefreshCache(): void {
  urlCache.clear();
  failedIds.clear();
  inflightPromises.clear();
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  batchQueue = [];
}

/**
 * Check if we have a cached refreshed URL for a media item
 */
export function getCachedRefreshUrl(mediaId: string): RefreshedUrls | null {
  return urlCache.get(mediaId) ?? null;
}

// ── Internals ────────────────────────────────────────────────

const MAX_BATCH = 50;

async function flushBatch(eventHash: string): Promise<void> {
  batchTimer = null;

  // Drain the queue
  const items = batchQueue.splice(0, MAX_BATCH);
  if (items.length === 0) return;

  // If there are leftovers beyond MAX_BATCH, schedule another flush
  if (batchQueue.length > 0) {
    batchTimer = setTimeout(() => flushBatch(eventHash), 50);
  }

  const mediaIds = items.map(i => i.mediaId);

  try {
    const res = await fetch('/api/gallery/refresh-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventHash, mediaIds }),
    });

    if (!res.ok) {
      throw new Error(`Refresh API returned ${res.status}`);
    }

    const data: { urls: Record<string, RefreshedUrls> } = await res.json();

    for (const item of items) {
      const urls = data.urls[item.mediaId];
      if (urls && (urls.thumbnail || urls.preview || urls.original)) {
        urlCache.set(item.mediaId, urls);
        item.resolve(urls);
      } else {
        // Server didn't return URLs for this ID — mark as failed
        failedIds.add(item.mediaId);
        item.resolve(null);
      }
    }
  } catch (err) {
    // Network error or server error — resolve all as null (don't crash components)
    console.error('[url-refresh] Batch refresh failed:', err);
    for (const item of items) {
      failedIds.add(item.mediaId);
      item.resolve(null);
    }
  }
}
