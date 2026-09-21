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
 *
 * `id="gallery-footer"` is load-bearing: GalleryPageClient observes it to hide
 * the floating face-search pill once the footer is on screen, so the pill (and
 * its glow) never sits on top of the credit.
 */

// UTM-tagged so gallery-driven signups are attributable. Every guest at every
// event sees this line, and some of them are photographers or organisers —
// it is the cheapest acquisition channel the product has.
const PIXTRACE_URL = '/?utm_source=gallery&utm_medium=footer&utm_campaign=powered_by';

function PoweredBy() {
  return (
    <a
      href={PIXTRACE_URL}
      target="_blank"
      rel="noopener"
      // gray-600 on white is 7.56:1 — comfortably past AA's 4.5:1 rather than
      // sitting just above it.
      className="group inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 rounded"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={16} height={16} className="w-4 h-4 rounded-sm" />
      <span>
        Photographers: get a gallery like this with <span className="font-semibold">PIXTRACE</span>
      </span>
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
    </a>
  );
}

export function GalleryFooter({
  credit,
  showPoweredBy,
  eventHash,
}: {
  credit: PhotographerCredit | null;
  showPoweredBy: boolean;
  eventHash: string;
}) {
  // `credit` and `showPoweredBy` are independent, so there are four cases:
  //
  //   credit  poweredBy  →  render
  //   ──────  ─────────     ─────────────────────────────────────────
  //   null    true          our line only (the day-one path for everyone)
  //   null    false         NOTHING — not an empty bordered strip
  //   set     true          credit + our line beneath it
  //   set     false         credit alone
  if (!credit) {
    if (!showPoweredBy) return null;
    return (
      <footer id="gallery-footer" className="border-t border-gray-100 py-8 flex justify-center px-4">
        <PoweredBy />
      </footer>
    );
  }

  return (
    <footer id="gallery-footer" className="border-t border-gray-100 bg-gray-50/70">
      {/* Wider than the old 28rem column, so a desktop footer is a row rather
          than a narrow strip marooned in white space. */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <CreditLinks credit={credit} eventHash={eventHash} />
      </div>
      {showPoweredBy && (
        <div className="border-t border-gray-100 py-4 flex justify-center px-4">
          <PoweredBy />
        </div>
      )}
    </footer>
  );
}
