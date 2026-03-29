/**
 * Upload public/homepage/* to R2 under prefix homepage/
 *
 * Requires .env.local: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Usage: npx tsx scripts/upload-homepage-assets-to-r2.ts
 * Then set NEXT_PUBLIC_HERO_IMAGES_BASE_URL=https://<your-pub-r2-host>/homepage
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const LOCAL_DIR = path.join(process.cwd(), 'public', 'homepage');
const R2_PREFIX = 'homepage';

function contentType(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Missing R2 env vars. Load .env.local with R2_* credentials.');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const names = await readdir(LOCAL_DIR);
  const files = names.filter((n) => !n.startsWith('.') && n !== 'README.md');

  for (const file of files) {
    const body = await readFile(path.join(LOCAL_DIR, file));
    const key = `${R2_PREFIX}/${file}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType(file),
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    console.log(`Uploaded ${key} (${body.length} bytes)`);
  }

  console.log('\nSet NEXT_PUBLIC_HERO_IMAGES_BASE_URL to your R2 public base + /homepage, e.g.');
  console.log('  NEXT_PUBLIC_HERO_IMAGES_BASE_URL=https://pub-xxxx.r2.dev/homepage');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
