import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.in';

  return {
    rules: [
      {
        userAgent: '*',
        // Public marketing surface. Event galleries (/<slug> and /gallery/<hash>)
        // are deliberately NOT disallowed here: they carry
        // `noindex, noimageindex` in their metadata and an X-Robots-Tag header,
        // and a crawler that is blocked from fetching them can never read those
        // directives — a blocked URL can still be indexed from an inbound link.
        // Letting Googlebot fetch and then obey the noindex is what actually
        // keeps guest photos out of Search and Image Search.
        allow: ['/', '/pricing', '/enterprise'],
        disallow: [
          // Authenticated app — also carries `noindex` in its layout metadata.
          '/dashboard',
          '/settings',
          '/billing',
          '/events',
          '/admin',
          '/profile',
          '/account',
          '/onboarding',
          '/checkout',
          '/preview/',
          // Auth screens: no index value, and they generate infinite
          // ?redirect= permutations.
          '/sign-in',
          '/sign-up',
          '/auth',
          // Internals
          '/api/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
