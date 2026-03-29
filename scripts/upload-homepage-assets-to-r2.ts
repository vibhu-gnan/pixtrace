/**
 * Upload public/homepage/ images to Cloudflare R2 under the prefix homepage/.
 *
 * Features:
 *  - Skips files that are already in R2 with the same byte length (ETag-free,
 *    Content-Length-based idempotency check). Pass --force to re-upload all.
 *  - Uploads up to CONCURRENCY files in parallel.
 *  - Only processes recognised image types (.jpg/.jpeg/.png/.webp/.avif).
 *  - Continues after per-file errors; prints a summary at the end.
 *  - Dry-run mode: pass --dry-run to print what would be uploaded.
 *
 * Usage:
 *   npx tsx scripts/upload-homepage-assets-to-r2.ts
 *   npx tsx scripts/upload-homepage-assets-to-r2.ts --force
 *   npx tsx scripts/upload-homepage-assets-to-r2.ts --dry-run
 *
 * After upload, set in .env.production (or Vercel env):
 *   NEXT_PUBLIC_HERO_IMAGES_BASE_URL=https://pub-<hash>.r2.dev/homepage
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// ── Config ──────────────────────────────────────────────────────────────────
const LOCAL_DIR = path.join(process.cwd(), 'public', 'homepage');
const R2_PREFIX = 'homepage';
const CONCURRENCY = 4;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

// ── Arg parsing ─────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

// ── Helpers ─────────────────────────────────────────────────────────────────
function getR2Client(accountId: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // Increase timeout for large files on slow connections.
    requestHandler: { requestTimeout: 60_000 },
  });
}

/** Check whether the R2 object already exists with the same byte length. */
async function isAlreadyUploaded(
  client: S3Client,
  bucket: string,
  key: string,
  localSize: number,
): Promise<boolean> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength === localSize;
  } catch {
    return false; // Not found or any other error → upload.
  }
}

/** Run an array of async tasks with a capped concurrency. */
async function pool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // Validate env vars.
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
      .filter((k) => !process.env[k])
      .join(', ');
    console.error(`[upload] Missing env vars: ${missing}\n  Load .env.local with R2_* credentials.`);
    process.exit(1);
  }

  const client = getR2Client(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY);

  // Enumerate local files.
  let entries: string[];
  try {
    entries = await readdir(LOCAL_DIR);
  } catch {
    console.error(`[upload] Cannot read directory: ${LOCAL_DIR}`);
    process.exit(1);
  }

  const files = entries
    .filter((n) => !n.startsWith('.'))
    .filter((n) => IMAGE_EXTENSIONS.has(path.extname(n).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.log('[upload] No image files found in public/homepage/. Nothing to upload.');
    return;
  }

  if (DRY_RUN) console.log('[upload] DRY RUN — no changes will be made.\n');

  // Build per-file upload tasks.
  const stats = { uploaded: 0, skipped: 0, failed: 0 };

  const tasks = files.map((file) => async () => {
    const localPath = path.join(LOCAL_DIR, file);
    const key = `${R2_PREFIX}/${file}`;
    const ext = path.extname(file).toLowerCase();
    const contentType = CONTENT_TYPE[ext] ?? 'application/octet-stream';

    let body: Buffer;
    let localSize: number;
    try {
      body = await readFile(localPath);
      localSize = (await stat(localPath)).size;
    } catch (err) {
      console.error(`  ✗ ${file} — cannot read: ${(err as Error).message}`);
      stats.failed++;
      return;
    }

    // Skip-existing check.
    if (!FORCE && !DRY_RUN) {
      const exists = await isAlreadyUploaded(client, R2_BUCKET_NAME, key, localSize);
      if (exists) {
        console.log(`  ↷ ${key} (${localSize} bytes) — already up to date, skipping`);
        stats.skipped++;
        return;
      }
    }

    if (DRY_RUN) {
      console.log(`  ○ would upload ${key} (${localSize} bytes, ${contentType})`);
      stats.uploaded++;
      return;
    }

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: localSize,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      console.log(`  ✓ ${key} (${localSize} bytes)`);
      stats.uploaded++;
    } catch (err) {
      console.error(`  ✗ ${file} — upload failed: ${(err as Error).message}`);
      stats.failed++;
    }
  });

  console.log(`Uploading ${files.length} file(s) to R2 bucket "${R2_BUCKET_NAME}"…\n`);
  await pool(tasks, CONCURRENCY);

  // Summary.
  console.log(
    `\nDone. Uploaded: ${stats.uploaded}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`,
  );

  if (stats.failed > 0) {
    console.error('[upload] Some files failed. Re-run to retry, or inspect errors above.');
    process.exit(1);
  }

  if (!DRY_RUN) {
    const pubBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, '') ?? 'https://pub-<hash>.r2.dev';
    console.log('\nSet NEXT_PUBLIC_HERO_IMAGES_BASE_URL in .env.production:');
    console.log(`  NEXT_PUBLIC_HERO_IMAGES_BASE_URL=${pubBase}/homepage`);
  }
}

main().catch((err) => {
  console.error('[upload] Unexpected error:', err);
  process.exit(1);
});
