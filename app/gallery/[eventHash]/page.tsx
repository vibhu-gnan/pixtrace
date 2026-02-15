import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getPublicGallery } from '@/actions/gallery';
import { GalleryPageClient } from '@/components/gallery/gallery-page-client';

// Dynamic — always fetch fresh data so cover changes reflect immediately
export const dynamic = 'force-dynamic';

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
    const { event, media } = await getCachedGallery(eventHash);

    if (!event) {
      return {
        title: 'Gallery Not Found',
      };
    }

    const coverImage = media.find((m) => m.media_type === 'image');
    const coverUrl = coverImage?.full_url || coverImage?.original_url;

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
    const { event, media, albums, totalCount } = await getCachedGallery(eventHash);

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

    // Use cover_media_id if set, otherwise fall back to first image
    const coverImage = (event.cover_media_id
      ? media.find((m) => m.id === event.cover_media_id)
      : null) || media.find((m) => m.media_type === 'image');
    const coverUrl = coverImage?.full_url || coverImage?.original_url || '';

    return (
      <main className="min-h-screen bg-white">
        {/* ── Hero Section ─────────────────────────────────── */}
        <section className="relative w-full h-screen overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={event.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gray-800" />
          )}
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60" />

          {/* Centered event info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 px-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-center uppercase">
              {event.name}
            </h1>
            {formattedDate && (
              <p className="mt-2 text-sm sm:text-base text-white/80 tracking-wide">
                {formattedDate}
              </p>
            )}
            <a
              href="#gallery"
              className="mt-6 inline-block px-6 py-2.5 border-2 border-white text-white text-sm font-semibold tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-300"
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
