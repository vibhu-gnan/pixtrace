/**
 * Resize + compress hero JPEGs in public/homepage/ using sharp.
 *
 * Features:
 *  - Atomic writes: outputs to a temp file first, renames on success — a
 *    crash mid-conversion never leaves a corrupt file in place.
 *  - Per-file error isolation: one bad file doesn't stop the rest.
 *  - --dry-run: show what would change without writing anything.
 *  - --force: re-compress even if the file is already below the target size.
 *  - Skips files where width ≤ MAX_W and size ≤ SIZE_THRESHOLD_KB (already
 *    optimised), unless --force is passed.
 *
 * Usage:
 *   node scripts/optimize-homepage-images.mjs
 *   node scripts/optimize-homepage-images.mjs --dry-run
 *   node scripts/optimize-homepage-images.mjs --force
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

// ── Config ──────────────────────────────────────────────────────────────────
const DIR = path.join(process.cwd(), 'public', 'homepage');
const MAX_W = 1400;
const JPEG_QUALITY = 82;
/** Skip already-small files (bytes). Overridden by --force. */
const SIZE_THRESHOLD = 250 * 1024; // 250 KB

// ── Arg parsing ─────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  let entries;
  try {
    entries = await fs.readdir(DIR);
  } catch {
    console.error(`[optimize] Cannot read directory: ${DIR}`);
    process.exit(1);
  }

  const names = entries
    .filter((n) => /^hero-\d+\.jpe?g$/i.test(n))
    .sort();

  if (names.length === 0) {
    console.log('[optimize] No hero-*.jpg files found in public/homepage/.');
    return;
  }

  if (DRY_RUN) console.log('[optimize] DRY RUN — no files will be written.\n');

  const stats = { processed: 0, skipped: 0, failed: 0, savedBytes: 0 };

  for (const name of names) {
    const filePath = path.join(DIR, name);

    let buf;
    try {
      buf = await fs.readFile(filePath);
    } catch (err) {
      console.error(`  ✗ ${name} — cannot read: ${err.message}`);
      stats.failed++;
      continue;
    }

    const before = buf.length;

    // Quick skip if already small enough and we're not forcing.
    if (!FORCE && before <= SIZE_THRESHOLD) {
      // Even for small files, check that the width is within budget.
      let meta;
      try {
        meta = await sharp(buf).metadata();
      } catch {
        meta = {};
      }
      if ((meta.width ?? MAX_W + 1) <= MAX_W) {
        console.log(`  ↷ ${name} — already optimised (${fmtBytes(before)}), skipping`);
        stats.skipped++;
        continue;
      }
    }

    if (DRY_RUN) {
      let meta = {};
      try { meta = await sharp(buf).metadata(); } catch { /* ignore */ }
      console.log(
        `  ○ ${name} — would compress (${fmtBytes(before)}, ${meta.width ?? '?'}×${meta.height ?? '?'})`,
      );
      stats.processed++;
      continue;
    }

    // Write to a temp file in the OS temp dir; rename on success (atomic).
    const tmpPath = path.join(os.tmpdir(), `pixtrace-hero-${name}.tmp`);
    try {
      const out = await sharp(buf)
        .rotate() // Auto-rotate based on EXIF orientation.
        .resize({ width: MAX_W, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

      await fs.writeFile(tmpPath, out);
      await fs.rename(tmpPath, filePath);

      const saved = before - out.length;
      console.log(
        `  ✓ ${name}: ${fmtBytes(before)} → ${fmtBytes(out.length)}` +
          (saved > 0 ? ` (saved ${fmtBytes(saved)})` : ' (no size change)'),
      );
      stats.processed++;
      stats.savedBytes += Math.max(0, saved);
    } catch (err) {
      // Clean up temp file if it was written before the error.
      try { await fs.unlink(tmpPath); } catch { /* ignore */ }
      console.error(`  ✗ ${name} — optimisation failed: ${err.message}`);
      stats.failed++;
    }
  }

  console.log(
    `\nDone. Processed: ${stats.processed}, Skipped: ${stats.skipped}, Failed: ${stats.failed}` +
      (stats.savedBytes > 0 && !DRY_RUN ? `, Total saved: ${fmtBytes(stats.savedBytes)}` : ''),
  );

  if (stats.failed > 0) {
    console.error('[optimize] Some files failed. Original files are untouched.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[optimize] Unexpected error:', err);
  process.exit(1);
});
