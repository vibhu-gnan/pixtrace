import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — sample 10% of transactions in prod
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay — capture 1% normally, 100% on errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    // Network errors that are normal
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // Chunk loading (already handled by reload)
    "Loading chunk",
    "ChunkLoadError",
    // ResizeObserver noise
    "ResizeObserver loop",
  ],

  // Tag environment
  environment: process.env.NODE_ENV,

  beforeSend(event) {
    // Strip PII from URLs — don't log auth tokens or email addresses
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url);
        url.searchParams.delete("token");
        url.searchParams.delete("email");
        url.searchParams.delete("code");
        event.request.url = url.toString();
      } catch {
        // ignore malformed URLs
      }
    }
    return event;
  },
});
