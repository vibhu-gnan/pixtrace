import type { Metadata } from 'next';

// Sign-in / sign-up / checkout: no standalone search value, and the
// ?redirect= query permutations would otherwise create duplicate URLs.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
