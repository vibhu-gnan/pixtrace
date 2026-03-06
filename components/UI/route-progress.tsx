'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Lightweight progress bar for route transitions.
 * Uses only usePathname (no useSearchParams → no Suspense needed).
 * Mount once in a layout, not per-shell.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide bar when pathname changes (navigation complete)
  useEffect(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [pathname]);

  // Single global click listener to detect internal link clicks
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (
        !href ||
        href === pathname ||
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.hasAttribute('download') ||
        anchor.target === '_blank'
      ) {
        return;
      }

      setVisible(true);

      // Safety: auto-hide after 8s in case navigation doesn't complete
      timerRef.current = setTimeout(() => setVisible(false), 8000);
    },
    [pathname],
  );

  useEffect(() => {
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleClick]);

  if (!visible) return null;

  return <div className="route-progress-bar" aria-hidden="true" />;
}
