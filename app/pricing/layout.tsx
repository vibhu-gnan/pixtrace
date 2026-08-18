import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.in';

export const metadata: Metadata = {
  title: 'Pricing - Event Gallery Plans for Photographers',
  description:
    'PIXTRACE pricing plans for event photographers. Free plan available. Starter from ₹2,499/month. Pro with unlimited events at ₹4,999/month. Custom enterprise solutions available.',
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

// Keep these in sync with `pricingPlans` in ./page.tsx — Google penalises
// structured data that disagrees with the visible page.
const offers = [
  { name: 'Free', price: '0', description: 'Basic gallery hosting. 1 GB storage, 1 event.' },
  { name: 'Starter', price: '2499', description: '10 GB storage, up to 5 events, original-quality downloads.' },
  { name: 'Pro', price: '4999', description: 'Unlimited events, 50 GB storage, custom branding and client proofing.' },
];

function PricingJsonLd() {
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'PIXTRACE Event Photo Gallery',
    description:
      'Event photo gallery platform with AI face recognition and QR code sharing for wedding and event photographers.',
    brand: { '@type': 'Brand', name: 'PIXTRACE' },
    url: `${siteUrl}/pricing`,
    image: `${siteUrl}/og-image.jpg`,
    offers: offers.map((offer) => ({
      '@type': 'Offer',
      name: `${offer.name} plan`,
      description: offer.description,
      price: offer.price,
      priceCurrency: 'INR',
      url: `${siteUrl}/pricing`,
      availability: 'https://schema.org/InStock',
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${siteUrl}/pricing` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PricingJsonLd />
      {children}
    </>
  );
}
