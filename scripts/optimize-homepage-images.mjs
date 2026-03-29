/**
 * Resize hero JPEGs in public/homepage/ for smaller repo + faster builds.
 * Max width 1400px, mozjpeg quality ~82. Run after replacing hero-*.jpg sources.
 *
 * Usage: node scripts/optimize-homepage-images.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const DIR = path.join(process.cwd(), 'public', 'homepage');
const MAX_W = 1400;

async function main() {
  const names = (await fs.readdir(DIR)).filter((n) => /^hero-\d+\.jpe?g$/i.test(n));
  for (const name of names.sort()) {
    const p = path.join(DIR, name);
    const buf = await fs.readFile(p);
    const before = buf.length;
    const out = await sharp(buf)
      .rotate()
      .resize({ width: MAX_W, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    await fs.writeFile(p, out);
    console.log(`${name}: ${before} → ${out.length} bytes`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
