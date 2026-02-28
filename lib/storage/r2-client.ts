import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ── Custom Error Types ────────────────────────────────────────
// Callers can distinguish config issues from runtime access issues.

/** Thrown when required R2 environment variables are missing */
export class R2ConfigError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`R2 storage not configured. Missing env vars: ${missing.join(', ')}`);
    this.name = 'R2ConfigError';
    this.missing = missing;
  }
}

/** Thrown when R2 rejects a request (wrong credentials, missing object, etc.) */
export class R2AccessError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'R2AccessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ── Lazy-Initialised R2 Client ────────────────────────────────
// Validates env vars on FIRST USE, not at import time.
// This prevents the entire app from crashing at boot if env vars
// are temporarily missing during a deploy or config change.

let _client: S3Client | null = null;
let _bucket: string | null = null;
let _configError: R2ConfigError | null = null; // Cache the error so we log once

function ensureR2(): { client: S3Client; bucket: string } {
  // Fast path — already initialised
  if (_client && _bucket) return { client: _client, bucket: _bucket };

  // If we already know config is broken, throw the cached error
  if (_configError) throw _configError;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  const missing = [
    !accountId && 'R2_ACCOUNT_ID',
    !accessKeyId && 'R2_ACCESS_KEY_ID',
    !secretAccessKey && 'R2_SECRET_ACCESS_KEY',
    !bucketName && 'R2_BUCKET_NAME',
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    _configError = new R2ConfigError(missing);
    console.error(`[R2] ${_configError.message}`);
    throw _configError;
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });
  _bucket = bucketName!;

  return { client: _client, bucket: _bucket };
}

/** Get the lazy-initialised S3Client (validates env on first call) */
export function getR2Client(): S3Client {
  return ensureR2().client;
}

/** Get the validated bucket name */
export function getR2BucketName(): string {
  return ensureR2().bucket;
}

// ── Helper: classify SDK errors ──────────────────────────────

function classifyError(err: unknown, key: string): R2AccessError | R2ConfigError | Error {
  if (err instanceof R2ConfigError) return err;

  // AWS SDK errors carry $metadata.httpStatusCode and Code/name
  const meta = (err as any)?.$metadata;
  const statusCode = meta?.httpStatusCode ?? 0;
  const code = (err as any)?.Code ?? (err as any)?.name ?? 'Unknown';

  if (statusCode === 403 || code === 'AccessDenied' || code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') {
    return new R2AccessError(
      `R2 access denied for key "${key}". Check R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.`,
      403,
      code,
    );
  }

  if (statusCode === 404 || code === 'NoSuchKey') {
    return new R2AccessError(`R2 object not found: "${key}"`, 404, 'NoSuchKey');
  }

  if (statusCode >= 500) {
    return new R2AccessError(`R2 service error (${statusCode}) for key "${key}"`, statusCode, code);
  }

  // Network / timeout / unknown
  return err instanceof Error ? err : new Error(String(err));
}

// ── Public API ───────────────────────────────────────────────

/**
 * Generate a presigned GET URL for reading from the private R2 bucket.
 * Signing is local (HMAC, no network call) — ~0.1ms per URL.
 *
 * @param key     R2 object key
 * @param expiresIn Seconds until URL expires (default: 4 hours)
 * @throws {R2ConfigError} if env vars are missing
 * @throws {Error} if signing fails for any other reason
 */
export async function getSignedR2Url(key: string, expiresIn = 14400): Promise<string> {
  if (!key) {
    console.warn('[R2] getSignedR2Url called with empty key — returning empty string');
    return '';
  }

  try {
    const { client, bucket } = ensureR2();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(client, command, { expiresIn });
  } catch (err) {
    // Log once, rethrow so callers can decide how to handle
    console.error(`[R2] Failed to sign URL for key "${key}":`, err);
    throw classifyError(err, key);
  }
}

/**
 * Fetch an R2 object directly via the SDK (for server-side proxy routes).
 * Returns the response body as a Uint8Array.
 *
 * @throws {R2ConfigError} if env vars are missing
 * @throws {R2AccessError} with statusCode 403 (credentials) or 404 (not found)
 */
export async function getR2Object(key: string): Promise<{ body: Uint8Array; contentType: string }> {
  try {
    const { client, bucket } = ensureR2();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);

    if (!response.Body) {
      throw new R2AccessError(`R2 object has no body: "${key}"`, 404, 'EmptyBody');
    }

    const body = await response.Body.transformToByteArray();
    const contentType = response.ContentType || 'application/octet-stream';
    return { body, contentType };
  } catch (err) {
    if (err instanceof R2AccessError || err instanceof R2ConfigError) throw err;
    throw classifyError(err, key);
  }
}

/**
 * Check if an object exists in R2
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    const { client, bucket } = ensureR2();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete an object from R2
 */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = ensureR2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Delete multiple objects from R2 (parallel)
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await Promise.all(keys.map(key => deleteObject(key)));
}

/**
 * List all object keys in the R2 bucket (handles pagination)
 */
export async function listAllObjects(): Promise<string[]> {
  const { client, bucket } = ensureR2();
  const allKeys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) allKeys.push(obj.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return allKeys;
}
