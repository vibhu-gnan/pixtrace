/**
 * Backfill script: Generate thumbnail + preview variants for existing media
 *
 * Downloads each original from R2, generates variants using sharp,
 * uploads them back to R2, and updates the media record in Supabase.
 *
 * Usage: npx tsx scripts/backfill-variants.ts
 *   --dry-run    Preview what would be done without making changes
 *   --limit N    Only process N records
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import sharp from 'sharp';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

// ---------- Config ----------

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

// ---------- Helpers ----------

async function downloadFromR2(key: string): Promise<Buffer> {
  const response = await r2Client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );
  const stream = response.Body as any;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
}

async function generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(200, 200, { fit: 'cover', position: 'centre' })
    .webp({ quality: 50 })
    .toBuffer();
}

async function generatePreview(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

// ---------- Main ----------

async function main() {
  console.log('=== Backfill Image Variants ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} records`);
  console.log('');

  // Fetch media records that are missing variants
  let query = supabase
    .from('media')
    .select('id, r2_key, thumbnail_r2_key, preview_r2_key, media_type, original_filename')
    .eq('media_type', 'image')
    .order('created_at', { ascending: true });

  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const { data: mediaRows, error } = await query;

  if (error) {
    console.error('Failed to fetch media:', error);
    process.exit(1);
  }

  // Filter to only those missing at least one variant
  const needsBackfill = (mediaRows || []).filter(
    (row) => !row.thumbnail_r2_key || !row.preview_r2_key
  );

  console.log(`Found ${mediaRows?.length || 0} total images, ${needsBackfill.length} need backfill`);
  console.log('');

  if (needsBackfill.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < needsBackfill.length; i++) {
    const row = needsBackfill[i];
    const progress = `[${i + 1}/${needsBackfill.length}]`;

    try {
      console.log(`${progress} Processing: ${row.original_filename}`);
      console.log(`         R2 key: ${row.r2_key}`);

      if (DRY_RUN) {
        console.log(`         Would generate: ${row.r2_key}_thumb.webp`);
        console.log(`         Would generate: ${row.r2_key}_preview.webp`);
        console.log('');
        success++;
        continue;
      }

      // Download original
      const originalBuffer = await downloadFromR2(row.r2_key);
      console.log(`         Downloaded: ${(originalBuffer.length / 1024).toFixed(0)} KB`);

      // Generate variants
      const thumbKey = `${row.r2_key}_thumb.webp`;
      const previewKey = `${row.r2_key}_preview.webp`;

      const [thumbBuffer, previewBuffer] = await Promise.all([
        row.thumbnail_r2_key ? null : generateThumbnail(originalBuffer),
        row.preview_r2_key ? null : generatePreview(originalBuffer),
      ]);

      // Upload variants
      if (thumbBuffer) {
        await uploadToR2(thumbKey, thumbBuffer, 'image/webp');
        console.log(`         Thumbnail: ${(thumbBuffer.length / 1024).toFixed(0)} KB`);
      }

      if (previewBuffer) {
        await uploadToR2(previewKey, previewBuffer, 'image/webp');
        console.log(`         Preview: ${(previewBuffer.length / 1024).toFixed(0)} KB`);
      }

      // Update DB record
      const updateData: any = {};
      if (thumbBuffer) updateData.thumbnail_r2_key = thumbKey;
      if (previewBuffer) updateData.preview_r2_key = previewKey;

      const { error: updateError } = await supabase
        .from('media')
        .update(updateData)
        .eq('id', row.id);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      console.log(`         Done!`);
      console.log('');
      success++;
    } catch (err: any) {
      console.error(`         FAILED: ${err.message}`);
      console.log('');
      failed++;
    }
  }

  console.log('=== Summary ===');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${needsBackfill.length}`);
}

main().catch(console.error);
