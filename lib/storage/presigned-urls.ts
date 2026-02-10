import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME } from './r2-client';

export interface PresignedUrlOptions {
  key: string;
  contentType: string;
  expiresIn?: number; // seconds, default 900 (15 minutes)
}

export interface PresignedUrlResult {
  url: string;
  uploadId: string;
  expiresAt: Date;
}

/**
 * Generate a presigned URL for direct upload to R2
 * @param options Upload options
 * @returns Presigned URL and metadata
 */
export async function generatePresignedUrl(
  options: PresignedUrlOptions
): Promise<PresignedUrlResult> {
  const { key, contentType, expiresIn = 900 } = options;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(r2Client, command, {
    expiresIn,
  });

  return {
    url,
    uploadId: key, // Use key as upload ID for tracking
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

/**
 * Generate multiple presigned URLs for bulk uploads
 * @param requests Array of upload requests
 * @returns Array of presigned URLs
 */
export async function generateBulkPresignedUrls(
  requests: PresignedUrlOptions[]
): Promise<PresignedUrlResult[]> {
  return Promise.all(requests.map(req => generatePresignedUrl(req)));
}
