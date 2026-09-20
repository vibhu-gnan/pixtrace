'use client';

import { useState } from 'react';
import { CreditCard } from './credit-card';
import type { PhotographerCredit, CreditChannel } from '@/lib/credit/types';
import { creditMonogram } from '@/lib/credit/types';

/**
 * The credit shown at a moment of completion rather than in the footer.
 *
 * Peak-end: people judge an experience by its emotional peak and its end, and
 * the end of a gallery visit is not the bottom of the page — it is the moment
 * the guest gets the photos they came for. A credit read there is remembered;
 * one in the footer is scrolled past, if it is reached at all.
 *
 * What this is NOT, deliberately: a modal, an overlay, an interstitial, or
 * anything that takes the scroll. The guest's goal is "find my photos", and a
 * product that blocks that is one photographers switch off after reading their
 * own reviews. Everything here sits in normal document flow and is dismissible.
 */

function shareBeacon(eventHash: string, fired: Set<string>, channel: CreditChannel) {
  if (fired.has(channel)) return;
  fired.add(channel);
  fetch(
    `/api/gallery/credit-click?hash=${encodeURIComponent(eventHash)}&channel=${encodeURIComponent(channel)}`,
    { method: 'POST', keepalive: true },
  ).catch(() => {});
}

/**
 * Inline banner above the results grid, shown once the guest has actually seen
 * photos of themselves. Mounted on the TAP that enters "Mine" mode — not when
 * the search resolves, because at that point the status pill is still up and
 * the guest has not seen a single photo yet.
 */
export function CreditResultsBanner({
  credit,
  eventHash,
  matchCount,
  onDismiss,
}: {
  credit: PhotographerCredit;
  eventHash: string;
  matchCount: number;
  onDismiss: () => void;
}) {
  const [fired] = useState(() => new Set<string>());
  const primary = credit.whatsappUrl || credit.instagramUrl || credit.websiteUrl || credit.emailUrl;
  const primaryChannel: CreditChannel = credit.whatsappUrl
    ? 'whatsapp'
    : credit.instagramUrl ? 'instagram' : credit.websiteUrl ? 'website' : 'email';

  return (
    <div className="mx-auto max-w-3xl px-4 pt-3">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        {credit.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={credit.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-gray-100" />
        ) : (
          <div aria-hidden="true" className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
            {creditMonogram(credit.displayName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {matchCount > 0 ? `Found ${matchCount} photo${matchCount === 1 ? '' : 's'} of you` : 'Your photos'}
          </p>
          <p className="text-xs text-gray-600 truncate">Shot by {credit.displayName}</p>
        </div>

        {primary && (
          <a
            href={primary}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => shareBeacon(eventHash, fired, primaryChannel)}
            className="shrink-0 h-10 px-4 inline-flex items-center rounded-lg text-sm font-semibold
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            style={
              credit.whatsappUrl
                ? { backgroundColor: '#25D366', color: '#111827' }   // 9.5:1 — see credit-card.tsx
                : { backgroundColor: '#111827', color: '#ffffff' }
            }
          >
            {credit.whatsappUrl ? 'Message' : 'Visit'}
          </a>
        )}

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Compact card at the end of the grid. The guest has finished scrolling, so
 * nothing is interrupted — this is the lowest-risk placement and the one to
 * ship first.
 */
export function CreditEndOfList({
  credit,
  eventHash,
}: {
  credit: PhotographerCredit;
  eventHash: string;
}) {
  const [fired] = useState(() => new Set<string>());
  return (
    <div className="mx-auto max-w-sm px-4 pt-2 pb-6">
      <CreditCard
        credit={credit}
        variant="compact"
        onChannelClick={(channel) => shareBeacon(eventHash, fired, channel)}
      />
    </div>
  );
}
