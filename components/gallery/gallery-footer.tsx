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
  // Only "PIXTRACE" is the link: the sentence reads as a quiet invitation, and
  // the brand name is the obvious thing to tap.
  return (
    // gray-600 on white is 7.56:1 — comfortably past AA's 4.5:1.
    <p className="inline-flex items-center gap-2 text-xs text-gray-600">
      {/* The favicon, not /logo.png: that file is 2880x1620 with a small mark
          in the middle, so at 16px it rendered as an invisible sliver. The
          favicon is the asset actually drawn for small sizes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon-32x32.png" alt="" width={18} height={18} className="w-[18px] h-[18px]" />
      <span>
        Create your own event gallery like this with{' '}
        <a
          href={PIXTRACE_URL}
          target="_blank"
          rel="noopener"
          className="font-semibold text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 rounded"
        >
          PIXTRACE
        </a>
      </span>
    </p>
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
