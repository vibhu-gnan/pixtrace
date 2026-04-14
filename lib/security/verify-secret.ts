import crypto from 'crypto';

/**
 * Timing-safe secret comparison.
 * Uses crypto.timingSafeEqual to prevent timing attacks on secret values.
 *
 * Returns false if either value is missing or lengths differ (the latter avoids
 * Buffer allocation on mismatched lengths, which is itself timing-safe for
 * length-mismatch cases since we return before the comparison).
 */
export function verifySecret(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected || !received) return false;
  // Build buffers first so we compare byte lengths, not JS character lengths.
  // String .length counts UTF-16 code units; multi-byte chars would cause
  // timingSafeEqual to throw on mismatched buffer sizes if we checked .length first.
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.timingSafeEqual(a, b);
}
