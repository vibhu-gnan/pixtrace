/**
 * Hero grid image configuration for the landing page.
 *
 * Files are committed to the repo under public/homepage/ and served
 * through Next.js image optimisation (WebP/AVIF, responsive sizes).
 *
 * Optionally, serve from Cloudflare R2 for global CDN delivery:
 *   1. npx tsx scripts/upload-homepage-assets-to-r2.ts
 *   2. Set NEXT_PUBLIC_HERO_IMAGES_BASE_URL=https://pub-<hash>.r2.dev/homepage
 *      (no trailing slash). next.config.ts already allows pub-*.r2.dev.
 *
 * To add/replace images: drop new JPEGs into public/homepage/, run
 *   node scripts/optimize-homepage-images.mjs
 * then update HERO_GRID below.
 */

export type HeroTile = {
  /** Filename under public/homepage/ — must match an actual file. */
  file: string;
  /** Tailwind height class for the tile. */
  h: string;
  /** `sizes` prop passed to next/image (hidden on mobile → 0px). */
  sizes: string;
  /** Tailwind gradient classes for the colour overlay, or '' for none. */
  overlay: string;
  /** Set true on the most LCP-critical tile (preloads early). */
  priority?: boolean;
  /** If present, renders the badge label (e.g. "PREMIUM GALLERY"). */
  badge?: string;
};

/** Build a validated image src. Falls back to the local public path when the
 *  env var is absent, empty, or not a valid URL prefix. Called at render-time
 *  on the server so process.env is always available. */
export function heroImageSrc(file: string): string {
  const raw = process.env.NEXT_PUBLIC_HERO_IMAGES_BASE_URL;
  if (raw) {
    const base = raw.trim().replace(/\/+$/, '');
    try {
      // Will throw for a non-URL string like "cdn" or "  ".
      new URL(`${base}/${file}`);
      return `${base}/${file}`;
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[PIXTRACE] NEXT_PUBLIC_HERO_IMAGES_BASE_URL "${raw}" is not a valid URL. ` +
            'Falling back to public/homepage/.',
        );
      }
    }
  }
  // Encode the filename so spaces / special chars don't break URLs, but keep
  // the leading slash so Next.js serves it from the public directory.
  return `/homepage/${encodeURIComponent(file)}`;
}

/**
 * Three-column hero grid layout — single source of truth shared by
 * page.tsx and any future component. Column 0 is offset -mt-12, column 2 is
 * offset -mt-8; column 1 has the featured tile with the PREMIUM GALLERY badge.
 */
export const HERO_GRID: HeroTile[][] = [
  // ── Column 1 (offset up) ────────────────────────────────────────────────
  [
    {
      file: 'hero-01.jpg',
      h: 'h-64',
      sizes: '(min-width: 1024px) 200px, 0px',
      overlay: 'from-blue-600/25 to-purple-600/25',
    },
    {
      file: 'hero-02.jpg',
      h: 'h-48',
      sizes: '(min-width: 1024px) 200px, 0px',
      overlay: 'from-purple-600/20 to-pink-600/20',
    },
    {
      file: 'hero-03.jpg',
      h: 'h-64',
      sizes: '(min-width: 1024px) 200px, 0px',
      overlay: 'from-pink-600/20 to-orange-600/20',
    },
  ],
  // ── Column 2 (featured) ──────────────────────────────────────────────────
  [
    {
      file: 'hero-04.jpg',
      h: 'h-56',
      sizes: '(min-width: 1024px) 220px, 0px',
      overlay: '',
      priority: true,
      badge: 'PREMIUM GALLERY',
    },
    {
      file: 'hero-05.jpg',
      h: 'h-72',
      sizes: '(min-width: 1024px) 220px, 0px',
      overlay: 'from-cyan-600/15 to-blue-600/15',
    },
  ],
  // ── Column 3 (offset down) ───────────────────────────────────────────────
  [
    {
      file: 'hero-06.jpg',
      h: 'h-48',
      sizes: '(min-width: 1024px) 200px, 0px',
      overlay: 'from-indigo-600/15 to-blue-600/15',
    },
    {
      file: 'hero-07.jpg',
      h: 'h-80',
      sizes: '(min-width: 1024px) 200px, 0px',
      overlay: 'from-slate-800/30 to-slate-900/40',
    },
  ],
];

/** Flat list of every expected filename — used by the upload/validate scripts. */
export const ALL_HERO_FILES: string[] = HERO_GRID.flat().map((t) => t.file);

/** Per-column Tailwind offset classes (index-matched to HERO_GRID). */
export const COLUMN_OFFSETS = ['-mt-12', '', '-mt-8'] as const;
