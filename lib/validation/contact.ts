/**
 * Contact-field validators, shared between the settings actions and anything
 * that renders a photographer's public credit.
 *
 * Deliberately a plain module, NOT under actions/ and with no 'use server':
 * every export of a 'use server' module becomes a POST endpoint, and Next.js
 * rejects non-async exports there outright. These are sync, pure, and belong
 * nowhere near the action surface.
 *
 * Each returns the cleaned value or `null`. `null` means "not usable" — callers
 * store null rather than the raw input, so a bad value is dropped, never
 * persisted half-validated.
 */

/** Strip phone to digits, +, spaces, and hyphens only. */
export function sanitizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[^\d+\-\s()]/g, '');
  if (!cleaned || cleaned.length > 20) return null;
  return cleaned;
}

/**
 * WhatsApp number for a wa.me link: digits only, country code included, no '+'.
 * wa.me rejects spaces, punctuation and a leading '+', so this is stricter than
 * `sanitizePhone` — that one keeps display formatting, this one has to dial.
 */
export function sanitizeWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  // 8 is the shortest plausible national number, 15 the E.164 maximum.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * Instagram handle. Accepts what people actually paste — '@name',
 * 'instagram.com/name', a full URL with query junk — and returns the bare
 * handle. Asking the user which form is wanted is a question they should never
 * have to answer.
 */
export function sanitizeInstagram(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim();
  v = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  v = v.replace(/^instagram\.com\//i, '');
  v = v.split(/[/?#]/)[0];       // drop trailing path, query, fragment
  v = v.replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(v)) return null;
  return v;
}

/**
 * Public website. https only — an http link on an https gallery is a mixed
 * scheme the browser will flag, and we are vouching for this URL to guests.
 * A bare domain is upgraded rather than rejected.
 */
export function sanitizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) v = `https://${v}`;
  if (!v.startsWith('https://')) return null;
  if (v.length > 200) return null;
  try {
    const url = new URL(v);
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Public business email. Intentionally separate from the login address. */
export function sanitizePublicEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v.length > 255) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v)) return null;
  return v;
}

/**
 * Branding logo R2 key. Unlike `sanitizeAvatarUrl`, external hosts are NOT
 * allowed — only our own bucket. That is what lets the story-card canvas load
 * this image through our proxy unconditionally; a Google or Gravatar URL has
 * CORS we do not control and would silently fail to draw.
 */
export function sanitizeBrandingKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return /^branding\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.\w{2,5}$/.test(raw) ? raw : null;
}

/** Collapse whitespace and cap length; returns null for an empty result. */
export function sanitizeText(raw: string | null | undefined, maxLength: number): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/\s+/g, ' ').slice(0, maxLength);
  return v || null;
}
