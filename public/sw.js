// ─── PIXTRACE Image Cache Service Worker ────────────────────
// Cache-first strategy for R2 image URLs.
// Once an image is fetched, it's stored in CacheStorage and
// served instantly on subsequent loads — even after page refresh.

const CACHE_NAME = 'pixtrace-images-v1';
const MAX_CACHE_ENTRIES = 500;

// ─── R2 Domain Matching ──────────────────────────────────────
// Match R2 public URLs. Covers:
//   - Default R2 dev domain: pub-*.r2.dev
//   - Custom domains configured in Cloudflare
//   - Cloudflare Images delivery: imagedelivery.net
const R2_URL_PATTERNS = [
    /\.r2\.dev\//,
    /imagedelivery\.net\//,
];

function isR2ImageRequest(url) {
    const href = url.href;
    return R2_URL_PATTERNS.some((pattern) => pattern.test(href));
}

// ─── Cache Eviction (FIFO, capped at MAX_CACHE_ENTRIES) ──────

async function trimCache(cacheName, maxEntries) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length <= maxEntries) return;

        // Delete oldest entries (FIFO — first inserted, first evicted)
        const toDelete = keys.length - maxEntries;
        for (let i = 0; i < toDelete; i++) {
            await cache.delete(keys[i]);
        }
    } catch (err) {
        // Cache API failure — log and continue, don't crash the SW
        console.warn('[SW] trimCache error:', err);
    }
}

// ─── Install & Activate ──────────────────────────────────────

self.addEventListener('install', () => {
    // Activate immediately, don't wait for old SW to finish
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Claim all open tabs so the SW takes effect immediately
            self.clients.claim(),
            // Delete old cache versions (e.g., pixtrace-images-v0)
            caches.keys().then((names) =>
                Promise.all(
                    names
                        .filter((n) => n.startsWith('pixtrace-images-') && n !== CACHE_NAME)
                        .map((n) => caches.delete(n))
                )
            ),
        ])
    );
});

// ─── Fetch Handler ───────────────────────────────────────────

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only intercept GET requests
    if (request.method !== 'GET') return;

    // Guard against malformed URLs
    let url;
    try {
        url = new URL(request.url);
    } catch {
        return;
    }

    // Only intercept R2 image URLs
    if (!isR2ImageRequest(url)) return;

    event.respondWith(handleImageRequest(event, request));
});

async function handleImageRequest(event, request) {
    const cache = await caches.open(CACHE_NAME);

    // 1. Cache-first: try cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // 2. Cache miss — fetch from network
    let response;
    try {
        response = await fetch(request);
    } catch {
        // Network completely unavailable, no cache hit — return 503
        return new Response('', { status: 503, statusText: 'Offline' });
    }

    // 3. Only cache successful image responses
    //    (avoid caching error pages, redirects, or non-image content)
    if (response.ok && isImageContentType(response)) {
        try {
            // Clone before consuming — response body is a one-time stream
            await cache.put(request, response.clone());
        } catch (err) {
            // QuotaExceededError: storage full — evict aggressively and retry once
            if (err.name === 'QuotaExceededError') {
                await trimCache(CACHE_NAME, Math.floor(MAX_CACHE_ENTRIES * 0.5));
                try {
                    await cache.put(request, response.clone());
                } catch {
                    // Still failing — give up caching, still return the response
                }
            }
        }

        // Evict oldest entries in background (keeps the SW alive until done)
        event.waitUntil(trimCache(CACHE_NAME, MAX_CACHE_ENTRIES));
    }

    return response;
}

// ─── Helpers ─────────────────────────────────────────────────

function isImageContentType(response) {
    const ct = response.headers.get('Content-Type') || '';
    return ct.startsWith('image/');
}
