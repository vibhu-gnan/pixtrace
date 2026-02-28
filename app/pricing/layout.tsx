import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - Event Gallery Plans for Photographers',
  description:
    'PIXTRACE pricing plans for event photographers. Free plan available. Starter from \u20B92,499/month. Pro with unlimited events at \u20B94,999/month. Custom enterprise solutions available.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'PIXTRACE Pricing - Event Gallery Plans for Photographers',
    description:
      'Choose the perfect plan for your event photography business. Free plan available. Pro plan with unlimited events, custom branding & 50 GB storage.',
    url: '/pricing',
    type: 'website',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
