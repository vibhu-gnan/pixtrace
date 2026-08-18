import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    // AVIF first, WebP fallback. PageSpeed flagged ~80 KiB of avoidable bytes
    // across the hero grid; these formats compress far better than the source JPEGs.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
      {
        protocol: "https",
        hostname: "pub-*.r2.dev",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    // Belt-and-braces for the "unlisted gallery" rule. The page-level metadata
    // already sends `noindex, noimageindex`, but a <meta> tag only protects an
    // HTML document — it cannot protect the image bytes themselves. An
    // X-Robots-Tag header travels with every response type, so a photo URL that
    // somehow gets crawled directly is still excluded from Image Search.
    const noIndex = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noimageindex, noarchive",
    };

    return [
      { source: "/gallery/:path*", headers: [noIndex] },
      { source: "/api/proxy-image", headers: [noIndex] },
      { source: "/api/download/:path*", headers: [noIndex] },
      { source: "/preview/:path*", headers: [noIndex] },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry build options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Suppress source map upload logs during build
  silent: !process.env.CI,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Source map handling
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Auto-instrumentation via webpack config
  webpack: {
    autoInstrumentServerFunctions: true,
    autoInstrumentMiddleware: true,
    autoInstrumentAppDirectory: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
