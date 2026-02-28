import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.in';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing'],
        disallow: [
          '/dashboard',
          '/settings',
          '/billing',
          '/events',
          '/profile',
          '/account',
          '/onboarding',
          '/sign-in',
          '/sign-up',
          '/auth',
          '/api/',
          '/gallery/',
          '/enterprise',
          '/_next/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
