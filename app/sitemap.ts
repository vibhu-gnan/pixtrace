import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.in';
  const lastModified = new Date();

  // Only public marketing routes belong here. Event galleries are intentionally
  // excluded — they are per-client URLs and shouldn't be submitted for indexing.
  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/enterprise`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
