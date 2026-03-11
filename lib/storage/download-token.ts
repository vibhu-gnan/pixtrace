import crypto from 'crypto';

/**
 * Signed download tokens for public (no-login) file downloads.
 *
 * Instead of exposing raw R2 keys in the URL, we sign them with an HMAC.
 * The token encodes: r2Key + expiry timestamp. Anyone with a valid token
 * can download the file until it expires, but they cannot forge a token
 * for a different key or extend the expiry.
 *
 * Token format:  base64url( r2Key + '|' + expiryUnixSec + '|' + hmacHex )
 */

const TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 hours (matches presigned URL TTL)

let _secretWarningLogged = false;

function getSecret(): string {
  const secret = process.env.DOWNLOAD_TOKEN_SECRET;
  if (secret && secret.length >= 32) return secret;

  // Fallback: derive from existing secrets so deployment doesn't break
  // if DOWNLOAD_TOKEN_SECRET isn't set yet. This is deterministic per env.
  if (!_secretWarningLogged) {
    const level = process.env.NODE_ENV === 'production' ? 'error' : 'warn';
    console[level]('[Security] DOWNLOAD_TOKEN_SECRET not set or too short (<32 chars). Using derived fallback. Set a dedicated 32+ char random secret in production.');
    _secretWarningLogged = true;
  }
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.R2_SECRET_ACCESS_KEY;
  if (!fallback) {
    throw new Error('DOWNLOAD_TOKEN_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set');
  }
  return crypto.createHash('sha256').update(`download-token:${fallback}`).digest('hex');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/**
 * Create a signed download token for a given R2 key.
 * The token is URL-safe and self-contained (no DB lookup needed to verify).
 */
export function createDownloadToken(r2Key: string, ttlSeconds = TOKEN_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${r2Key}|${expiresAt}`;
  const hmac = sign(payload);
  // base64url encode the full token
  return Buffer.from(`${payload}|${hmac}`).toString('base64url');
}

/**
 * Verify a download token and extract the R2 key.
 * Returns the r2Key on success, or null if invalid/expired.
 */
export function verifyDownloadToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const lastPipe = decoded.lastIndexOf('|');
    if (lastPipe === -1) return null;

    const payload = decoded.slice(0, lastPipe);
    const receivedHmac = decoded.slice(lastPipe + 1);

    // Verify signature (timing-safe)
    const expectedHmac = sign(payload);
    const receivedBuf = Buffer.from(receivedHmac, 'utf-8');
    const expectedBuf = Buffer.from(expectedHmac, 'utf-8');
    if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
      return null;
    }

    // Parse payload
    const pipeIdx = payload.lastIndexOf('|');
    if (pipeIdx === -1) return null;
    const r2Key = payload.slice(0, pipeIdx);
    const expiresAt = parseInt(payload.slice(pipeIdx + 1), 10);

    // Check expiry
    if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
      return null;
    }

    // Basic sanity: r2Key must not be empty
    if (!r2Key) return null;

    return r2Key;
  } catch {
    return null;
  }
}
