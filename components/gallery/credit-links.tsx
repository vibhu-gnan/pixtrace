'use client';

import { useRef, useCallback } from 'react';
import { CreditCard } from './credit-card';
import type { PhotographerCredit, CreditChannel } from '@/lib/credit/types';

/**
 * The credit card plus its click beacon.
 *
 * Split out from GalleryFooter so the footer itself can stay a server
 * component — the markup ships in the initial HTML and only this thin wrapper
 * costs the client bundle anything.
 */
export function CreditLinks({
  credit,
  eventHash,
}: {
  credit: PhotographerCredit;
  eventHash: string;
}) {
  // Once per channel per page view. Same shape as the album view tracking in
  // gallery-page-client.tsx, and it also absorbs React StrictMode's double
  // invocation in development.
  const firedRef = useRef<Set<string>>(new Set());

  const handleChannelClick = useCallback((channel: CreditChannel) => {
    if (firedRef.current.has(channel)) return;
    firedRef.current.add(channel);

    // Not awaited, and the caller never calls preventDefault: the beacon must
    // never stand between the guest and the thing they tapped. `keepalive`
    // matters here specifically — wa.me and mailto: background the tab on
    // mobile, and an ordinary fetch would be cancelled mid-flight.
    fetch(
      `/api/gallery/credit-click?hash=${encodeURIComponent(eventHash)}&channel=${encodeURIComponent(channel)}`,
      { method: 'POST', keepalive: true },
    ).catch(() => {
      // Analytics are never worth surfacing to a guest.
    });
  }, [eventHash]);

  return <CreditCard credit={credit} onChannelClick={handleChannelClick} />;
}
