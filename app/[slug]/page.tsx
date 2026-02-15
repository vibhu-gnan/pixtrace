import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getPublicGallery } from '@/actions/gallery';
import { GalleryPageClient } from '@/components/gallery/gallery-page-client';
import { HeroSlideshow } from '@/components/gallery/hero-slideshow';

// ISR: serve from edge cache, revalidate every hour
export const revalidate = 3600;

type Props = {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ photo?: string }>;
};

// Deduplicate getPublicGallery calls within the same request
// (generateMetadata + page component share one result)
const getCachedGallery = cache((identifier: string) => getPublicGallery(identifier));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    try {
        const { slug } = await params;

        // Ignore if slug is a known static route or file (though Next.js routing handles most)
        if (slug.includes('.')) return {};

        const { event, media, coverUrl: resolvedCoverUrl } = await getCachedGallery(slug);

        if (!event) {
            return {
                title: 'Gallery Not Found',
            };
        }

        const fallbackImage = media.find((m) => m.media_type === 'image');
        const coverUrl = resolvedCoverUrl || fallbackImage?.full_url || fallbackImage?.original_url;

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
            alternates: {
                canonical: `/${slug}`,
            }
        };
    } catch (error) {
        // console.error('Error fetching metadata:', error);
        return {
            title: 'PIXTRACE Gallery',
        };
    }
}

export default async function GallerySlugPage({
    params,
    searchParams,
}: Props) {
    try {
        const { slug } = await params;
        const { photo: initialPhotoId } = await searchParams;

        const { event, media, albums, totalCount, coverUrl: resolvedCoverUrl, heroSlides, heroIntervalMs } = await getCachedGallery(slug);

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

        // Use resolved cover URL, or fall back to first image in media
        const fallbackImage = media.find((m) => m.media_type === 'image');
        const coverUrl = resolvedCoverUrl || fallbackImage?.full_url || fallbackImage?.original_url || '';
        const firstSlideUrl = heroSlides[0]?.url || coverUrl;
        const hasSlideshow = heroSlides.length > 1;

        return (
            <main className="min-h-screen bg-white">
                {/* ── Hero Section ─────────────────────────────────── */}
                <section className="relative w-full h-screen overflow-hidden">
                    {/* SSR: first image rendered statically for LCP */}
                    {firstSlideUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={firstSlideUrl}
                            alt={event.name}
                            fetchPriority="high"
                            className="absolute inset-0 w-full h-full object-cover z-0"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gray-800" />
                    )}

                    {/* Client slideshow — only activates with 2+ slides */}
                    {hasSlideshow && (
                        <HeroSlideshow slides={heroSlides} intervalMs={heroIntervalMs} />
                    )}

                    {/* Dark gradient overlay */}
                    <div className={`absolute inset-0 z-10 bg-gradient-to-b ${hasSlideshow ? 'from-black/40 via-black/50 to-black/70' : 'from-black/30 via-black/40 to-black/60'}`} />

                    {/* Centered event info */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 px-4">
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
                        eventHash={event.event_hash || slug}
                        eventName={event.name}
                        description={event.description}
                        totalCount={totalCount}
                        initialPhotoId={initialPhotoId}
                        allowDownload={event.allow_download ?? true}
                    />
                </div>

                {/* Footer */}
                <footer className="py-8 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">Powered by PIXTRACE</p>
                </footer>
            </main>
        );
    } catch (error) {
        // Check if it's the notFound() error
        if ((error as any)?.digest === 'NEXT_NOT_FOUND') {
            throw error;
        }
        console.error('Error in GallerySlugPage:', error);
        notFound();
    }
}
