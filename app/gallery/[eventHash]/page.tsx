import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getPublicGallery } from '@/actions/gallery';
import { GalleryPageClient } from '@/components/gallery/gallery-page-client';
import { HeroSlideshow } from '@/components/gallery/hero-slideshow';

// ISR: serve from edge cache, revalidate every hour
export const revalidate = 3600;

type Props = {
  params: Promise<{ eventHash: string }>;
  searchParams: Promise<{ photo?: string }>;
};

// Deduplicate getPublicGallery calls within the same request
// (generateMetadata + page component share one result)
const getCachedGallery = cache((eventHash: string) => getPublicGallery(eventHash));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { eventHash } = await params;
    const { event, media, hero } = await getCachedGallery(eventHash);

    if (!event) {
      return {
        title: 'Gallery Not Found',
      };
    }

    // Use configured hero or fallback to first image
    let coverUrl = '';
    if (hero?.urls?.length) {
      coverUrl = hero.urls[0];
    } else {
      const coverImage = media.find((m) => m.media_type === 'image');
      coverUrl = coverImage ? (coverImage.full_url || coverImage.original_url) : '';
    }

    return {
      title: `${event.name} | PIXTRACE Gallery`,
      description: event.description || `View photos from ${event.name}`,
      openGraph: {
        title: event.name,
        description: event.description || `View photos from ${event.name}`,
        images: coverUrl ? [{ url: coverUrl }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: event.name,
        description: event.description || `View photos from ${event.name}`,
        images: coverUrl ? [coverUrl] : [],
      },
    };
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return {
      title: 'PIXTRACE Gallery',
    };
  }
}

export default async function GalleryEventPage({
  params,
  searchParams,
}: Props) {
  try {
    const { eventHash } = await params;
    const { photo: initialPhotoId } = await searchParams;
    const { event, media, albums, totalCount, hero } = await getCachedGallery(eventHash);

    if (!event) {
      notFound();
    }

    const formattedDate = event.event_date
      ? new Date(event.event_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      : null;

    // Determine hero content
    const heroType = hero?.type || 'image';
    let heroUrl = '';

    if (heroType === 'image') {
      if (hero?.urls?.length) {
        heroUrl = hero.urls[0];
      } else {
        // Fallback to first image
        const coverImage = media.find((m) => m.media_type === 'image');
        heroUrl = coverImage ? (coverImage.full_url || coverImage.original_url) : '';
      }
    }

    return (
      <main className="min-h-screen bg-white">
        {/* ── Hero Section ─────────────────────────────────── */}
        <section className="relative w-full h-screen overflow-hidden bg-gray-900">
          {heroType === 'slideshow' && hero?.urls?.length ? (
            <HeroSlideshow images={hero.urls} />
          ) : (
            heroUrl ? (
              <img
                src={heroUrl}
                alt={event.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gray-800" />
            )
          )}

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60 pointer-events-none" />

          {/* Centered event info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 px-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-center uppercase drop-shadow-md">
              {event.name}
            </h1>
            {formattedDate && (
              <p className="mt-2 text-sm sm:text-base text-white/90 tracking-wide drop-shadow-sm">
                {formattedDate}
              </p>
            )}
            <a
              href="#gallery"
              className="mt-8 inline-block px-8 py-3 border border-white/80 text-white text-sm font-semibold tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300 backdrop-blur-sm bg-black/10"
            >
              View Gallery
            </a>
          </div>
        </section>

        {/* ── Gallery Content ──────────────────────────────── */}
        <div id="gallery">
          <GalleryPageClient
            initialMedia={media}
            albums={albums}
            eventHash={eventHash}
            eventName={event.name}
            description={event.description}
            totalCount={totalCount}
            initialPhotoId={initialPhotoId}
          />
        </div>

        {/* Footer */}
        <footer className="py-8 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400">Powered by PIXTRACE</p>
        </footer>
      </main>
    );
  } catch (error) {
    console.error('Error in GalleryEventPage:', error);
    notFound();
  }
}
