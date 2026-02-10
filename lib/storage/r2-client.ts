import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// R2 S3-compatible client
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

/**
 * Get public URL for R2 object
 * If using custom domain, replace with your domain
 */
export function getR2PublicUrl(key: string): string {
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }
  return `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;
}

/**
 * Check if an object exists in R2
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete an object from R2
 */
export async function deleteObject(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Delete multiple objects from R2
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => deleteObject(key)));
}

/**
 * List all object keys in the R2 bucket (handles pagination)
 */
export async function listAllObjects(): Promise<string[]> {
  const allKeys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          allKeys.push(obj.Key);
        }
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return allKeys;
}
