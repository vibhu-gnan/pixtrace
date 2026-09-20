import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizerPlanLimits, hasFeature } from '@/lib/plans/limits';
import { buildCredit, type PhotographerCredit } from '@/lib/credit/types';

/**
 * Resolve the photographer credit for a public gallery.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ READ THIS BEFORE CHANGING THE CLIENT.                                   │
 * │                                                                         │
 * │ The `organizers` table has RLS enabled with only auth.uid()-scoped      │
 * │ policies and NO anon SELECT policy. Reading it with getPublicClient()   │
 * │ (the anon client used elsewhere in the gallery path) returns ZERO ROWS  │
 * │ SILENTLY — no error, no warning, no thrown exception. The credit would  │
 * │ simply stop appearing in production while still working locally, where  │
 * │ you are probably signed in.                                             │
 * │                                                                         │
 * │ It therefore uses createAdminClient(), with an explicit column          │
 * │ whitelist below so nothing else on the row can leak into a public page. │
 * │ Never widen that select to '*'. The same reasoning is why these are     │
 * │ discrete columns rather than one JSONB blob: the whitelist IS the       │
 * │ boundary, and a blob would carry future fields into it silently.        │
 * │                                                                         │
 * │ This mirrors how the codebase already reaches organizer data on public  │
 * │ pages — see getOrganizerPlanLimits and checkEventOwnership.             │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Never throws: a gallery must render even if this fails entirely.
 */
export interface CreditResolution {
  credit: PhotographerCredit | null;
  /**
   * Whether to show our own "Powered by PIXTRACE" mark. Returned alongside
   * rather than only on `credit`, because the two are independent: a
   * white-labelled organizer who has not configured a credit must get NEITHER,
   * and a footer holding a null credit would otherwise have no way to know.
   */
  showPoweredBy: boolean;
}

/** Safe default: over-crediting ourselves beats silently dropping our mark. */
const FALLBACK: CreditResolution = { credit: null, showPoweredBy: true };

export async function resolvePhotographerCredit(
  organizerId: string | null | undefined,
  theme: unknown,
  eventName: string,
): Promise<CreditResolution> {
  if (!organizerId) return FALLBACK;

  // `white_label` governs our mark whether or not a credit exists, so it is
  // resolved first and independently. Memoized per request by React cache(),
  // and the gallery has usually already paid for it checking downloads.
  let showPoweredBy = true;
  try {
    const limits = await getOrganizerPlanLimits(organizerId);
    showPoweredBy = !hasFeature(limits, 'white_label');
  } catch {
    // Non-critical — keep the default. Note the safe-failure direction is the
    // opposite of the allow_download downgrade: failing closed there withholds
    // a paid feature, failing open here just over-credits us.
  }

  // Per-event opt-out, checked before any further query so the hidden path is cheap.
  if ((theme as { hideCredit?: unknown } | null)?.hideCredit === true) {
    return { credit: null, showPoweredBy };
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('organizers')
      .select(
        'credit_enabled, credit_display_name, credit_tagline, credit_logo_url, credit_whatsapp, credit_instagram, credit_website, credit_public_email',
      )
      .eq('id', organizerId)
      .maybeSingle();

    if (error) {
      console.error('[credit] organizer lookup failed:', error.message);
      return { credit: null, showPoweredBy };
    }
    if (!data) {
      // A valid organizer id with no row back is the signature of the RLS trap
      // above — loud, because it is otherwise invisible.
      console.warn('[credit] no organizer row for id', organizerId, '— wrong Supabase client?');
      return { credit: null, showPoweredBy };
    }

    const row = data as {
      credit_enabled: boolean | null;
      credit_display_name: string | null;
      credit_tagline: string | null;
      credit_logo_url: string | null;
      credit_whatsapp: string | null;
      credit_instagram: string | null;
      credit_website: string | null;
      credit_public_email: string | null;
    };

    if (!row.credit_enabled) return { credit: null, showPoweredBy };

    // Logo: R2 keys are signed; legacy absolute URLs pass through. 24h rather
    // than the 14400s default — the gallery is ISR'd at an hour, and a signed
    // URL baked into cached HTML must outlive the cache that holds it.
    let logoUrl: string | null = null;
    let logoR2Key: string | null = null;
    const rawLogo = row.credit_logo_url;
    if (rawLogo) {
      if (rawLogo.startsWith('http://') || rawLogo.startsWith('https://')) {
        logoUrl = rawLogo;
      } else if (rawLogo.startsWith('branding/')) {
        logoR2Key = rawLogo;
        // Stable same-origin URL rather than a presigned one. The gallery is
        // ISR-cached for an hour and the story-card canvas fetches the same
        // image, so a signature that can expire inside the cache window is a
        // bug waiting to happen. /api/proxy-image authorizes `branding/` keys
        // against credit_enabled and serves them with a 24h cache header.
        logoUrl = `/api/proxy-image?r2Key=${encodeURIComponent(rawLogo)}`;
      }
    }

    const credit = buildCredit(
      {
        displayName: row.credit_display_name,
        tagline: row.credit_tagline,
        whatsapp: row.credit_whatsapp,
        instagram: row.credit_instagram,
        website: row.credit_website,
        publicEmail: row.credit_public_email,
      },
      eventName,
      { logoUrl, logoR2Key, showPoweredBy },
    );

    return { credit, showPoweredBy };
  } catch (err) {
    console.error('[credit] resolve failed:', err);
    return { credit: null, showPoweredBy };
  }
}
