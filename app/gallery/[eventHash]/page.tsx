import { notFound } from 'next/navigation';
import { getPublicGallery } from '@/actions/gallery';
import { GalleryPageClient } from '@/components/gallery/gallery-page-client';

export default async function GalleryEventPage({
  params,
}: {
  params: Promise<{ eventHash: string }>;
}) {
  const { eventHash } = await params;
  const { event, media, albums } = await getPublicGallery(eventHash);

  if (!event) {
    notFound();
  }

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Event Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Gallery</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{event.name}</h1>
            {event.description && (
              <p className="text-gray-500 text-base max-w-xl mx-auto mb-2">{event.description}</p>
            )}
            {formattedDate && (
              <p className="text-sm text-gray-400">{formattedDate}</p>
            )}
            <p className="text-xs text-gray-400 mt-3">
              {media.filter(m => m.media_type === 'image').length} photos
            </p>
          </div>
        </div>
      </header>

      {/* Gallery Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <GalleryPageClient media={media} albums={albums} />
      </div>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-gray-400">Powered by PIXTRACE</p>
      </footer>
    </main>
  );
}
