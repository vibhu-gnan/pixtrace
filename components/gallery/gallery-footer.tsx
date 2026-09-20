import type { PhotographerCredit } from '@/lib/credit/types';
import { CreditLinks } from './credit-links';

/**
 * The bottom of a public gallery.
 *
 * A server component on purpose: the credit lands in the initial HTML, so there
 * is no layout shift, no flash of an empty footer, and it still renders with
 * JavaScript disabled. Only the link row is a client component, and only
 * because it fires the click beacon.
 *
 * Used by BOTH public routes — app/[slug] and app/gallery/[eventHash] — which
 * previously carried identical copy-pasted footers.
 */
export function GalleryFooter({
  credit,
  showPoweredBy,
  eventHash,
  faceSearchEnabled = false,
}: {
  credit: PhotographerCredit | null;
  showPoweredBy: boolean;
  eventHash: string;
  /**
   * When face search is on, GalleryPageClient renders a fixed pill at the
   * bottom of the viewport ("Find Your Photos" / the ALL-Mine toggle). Measured
   * on production, it covered the footer's Instagram and Website buttons by
   * 44px once scrolled to the end — the secondary channels were tappable in
   * theory and hidden in practice. Reserve room for it.
   */
  faceSearchEnabled?: boolean;
}) {
  // `credit` and `showPoweredBy` are independent, so there are four cases:
  //
  //   credit  poweredBy  →  render
  //   ──────  ─────────     ─────────────────────────────────────────
  //   null    true          today's footer (the day-one path for everyone)
  //   null    false         NOTHING — not an empty bordered strip
  //   set     true          credit card + our mark
  //   set     false         credit card alone
  //
  // Row two is the one that bites: a white-labelled organizer who has not
  // configured a credit would otherwise get a bare 1px border and 5rem of
  // whitespace at the end of every gallery.
  const clearance = faceSearchEnabled ? ' pb-28' : '';

  if (!credit) {
    if (!showPoweredBy) return null;
    return (
      <footer className={`py-8 text-center border-t border-gray-100${clearance}`}>
        {/* gray-500 is 4.83:1 on white. gray-400 — what this was — is ~2.5:1
            and fails WCAG AA for normal text. */}
        <p className="text-xs text-gray-500">Powered by PIXTRACE</p>
      </footer>
    );
  }

  return (
    <footer className={`border-t border-gray-100 py-10 px-4${clearance}`}>
      <CreditLinks credit={credit} eventHash={eventHash} />
      {showPoweredBy && (
        <p className="mt-8 text-xs text-gray-500 text-center">Powered by PIXTRACE</p>
      )}
    </footer>
  );
}
