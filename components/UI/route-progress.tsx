'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin progress bar at the top of the page during route transitions.
 * Automatically shows on pathname or search param changes.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When route changes complete, hide the bar
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    // Intercept link clicks to detect navigation start
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
      // Internal navigation detected
      if (href !== pathname) {
        setLoading(true);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname]);

  if (!loading) return null;

  return <div className="route-progress-bar" />;
}
