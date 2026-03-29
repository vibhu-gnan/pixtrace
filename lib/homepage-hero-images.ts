/**
 * Landing hero grid images: commit files under public/homepage/.
 *
 * Optional CDN: after uploading the same folder to R2, set
 * NEXT_PUBLIC_HERO_IMAGES_BASE_URL to the public prefix, e.g.
 * https://pub-xxxxxxxx.r2.dev/homepage
 * (no trailing slash). next/image already allows pub-*.r2.dev.
 */

const HERO_DIR = 'homepage';

export function heroImageSrc(filename: string): string {
  const base = process.env.NEXT_PUBLIC_HERO_IMAGES_BASE_URL?.trim().replace(/\/$/, '');
  if (base) return `${base}/${filename}`;
  return `/${HERO_DIR}/${filename}`;
}

/** Order matches the 3-column hero collage (left → center → right). */
export const HERO_GRID_FILENAMES = {
  col1: ['hero-01.jpg', 'hero-02.jpg', 'hero-03.jpg'] as const,
  /** First tile shows PREMIUM GALLERY — use priority image loader. */
  col2: ['hero-04.jpg', 'hero-05.jpg'] as const,
  col3: ['hero-06.jpg', 'hero-07.jpg'] as const,
} as const;
