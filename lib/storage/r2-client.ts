import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
 * Generate a presigned GET URL for reading from the private R2 bucket.
 * Signing is local (HMAC, no network call) — ~0.1ms per URL.
 * @param key R2 object key
 * @param expiresIn Seconds until URL expires (default: 4 hours)
 */
export async function getSignedR2Url(key: string, expiresIn = 14400): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Fetch an R2 object directly via the SDK (for server-side proxy routes).
 * Returns the response body as a Uint8Array.
 */
export async function getR2Object(key: string): Promise<{ body: Uint8Array; contentType: string }> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  const response = await r2Client.send(command);
  if (!response.Body) {
    throw new Error(`R2 object has no body: ${key}`);
  }
  const body = await response.Body.transformToByteArray();
  const contentType = response.ContentType || 'application/octet-stream';
  return { body, contentType };
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
