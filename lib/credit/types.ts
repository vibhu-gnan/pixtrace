/**
 * The photographer credit, as everything downstream consumes it.
 *
 * Pure types and pure link-building — no DB, no server imports — so the same
 * module backs the server-resolved gallery footer AND the live preview in the
 * Branding settings form. The preview showing something the gallery wouldn't
 * is the failure mode this prevents.
 */

export type CreditChannel = 'whatsapp' | 'instagram' | 'website' | 'email' | 'profile';

/** Channels a click can be attributed to. Mirrors the CHECK constraint on
 *  credit_click_counts.channel and the whitelist inside increment_credit_click. */
export const CREDIT_CHANNELS: readonly CreditChannel[] = [
  'whatsapp', 'instagram', 'website', 'email', 'profile',
] as const;

export function isCreditChannel(value: unknown): value is CreditChannel {
  return typeof value === 'string' && (CREDIT_CHANNELS as readonly string[]).includes(value);
}

/** Resolved, render-ready. Every URL here is already safe to put in an href. */
export interface PhotographerCredit {
  displayName: string;
  tagline: string | null;
  /** Resolved https URL for <img>, or null — callers must handle null AND onError. */
  logoUrl: string | null;
  /** Set only for `branding/` R2 keys, i.e. images we can load onto a canvas. */
  logoR2Key: string | null;
  instagramHandle: string | null;
  whatsappUrl: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
  emailUrl: string | null;
  /** False only when the organizer's plan carries the `white_label` feature. */
  showPoweredBy: boolean;
}

/** The raw column values, as stored. */
export interface CreditFields {
  displayName: string | null;
  tagline: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  publicEmail: string | null;
}

/** WhatsApp truncates long prefills and we don't want a wall of text anyway. */
const MAX_PREFILL = 200;

/**
 * A prefilled first message. This is the single biggest lever on wa.me
 * conversion — an empty compose box is where people stall, because now they
 * have to work out how to introduce themselves.
 */
export function whatsappPrefill(displayName: string, eventName: string): string {
  const msg = `Hi ${displayName}, I saw the ${eventName} gallery and wanted to get in touch.`;
  return msg.length > MAX_PREFILL ? msg.slice(0, MAX_PREFILL - 1) + '…' : msg;
}

/**
 * Build the render-ready credit from stored fields.
 *
 * Values are expected to have passed lib/validation/contact.ts already; this
 * only assembles URLs. It never throws and never partially fails — a bad field
 * simply yields a null link rather than breaking the card.
 */
export function buildCredit(
  fields: CreditFields,
  eventName: string,
  opts: { logoUrl?: string | null; logoR2Key?: string | null; showPoweredBy?: boolean } = {},
): PhotographerCredit | null {
  const displayName = fields.displayName?.trim();
  if (!displayName) return null;

  const whatsappUrl = fields.whatsapp
    ? `https://wa.me/${fields.whatsapp}?text=${encodeURIComponent(whatsappPrefill(displayName, eventName))}`
    : null;
  const instagramUrl = fields.instagram ? `https://instagram.com/${fields.instagram}` : null;
  const websiteUrl = fields.website || null;
  const emailUrl = fields.publicEmail ? `mailto:${fields.publicEmail}` : null;

  // A credit with a name but no way to reach anyone is clutter on the gallery,
  // not marketing. Treat it as absent.
  if (!whatsappUrl && !instagramUrl && !websiteUrl && !emailUrl) return null;

  return {
    displayName,
    tagline: fields.tagline?.trim() || null,
    logoUrl: opts.logoUrl ?? null,
    logoR2Key: opts.logoR2Key ?? null,
    instagramHandle: fields.instagram || null,
    whatsappUrl,
    instagramUrl,
    websiteUrl,
    emailUrl,
    showPoweredBy: opts.showPoweredBy ?? true,
  };
}

/** First letter, for the monogram shown when there is no logo or it fails to load. */
export function creditMonogram(displayName: string): string {
  return (displayName.trim()[0] || '?').toUpperCase();
}
