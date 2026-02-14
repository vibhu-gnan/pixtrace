import { getMedia } from '@/actions/media';
import { getAlbums } from '@/actions/albums';
import { getEvent } from '@/actions/events';
import { PhotosPageClient } from '@/components/event/photos-page-client';
import { notFound } from 'next/navigation';
import { getOriginalUrl } from '@/lib/storage/cloudflare-images';

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await getEvent(eventId);
  if (!event) notFound();

  const [media, albums] = await Promise.all([
    getMedia(eventId),
    getAlbums(eventId),
  ]);

  // Compute cover preview URL server-side (avoids client env var issues)
  let savedCoverPreviewUrl: string | null = null;
  if (event.cover_type === 'upload' && event.cover_r2_key) {
    savedCoverPreviewUrl = getOriginalUrl(event.cover_r2_key);
  } else if (event.cover_type === 'single' && event.cover_media_id) {
    const found = media.find(m => m.id === event.cover_media_id);
    savedCoverPreviewUrl = found?.thumbnail_url ?? null;
  } else if (event.cover_type === 'first' && media.length > 0) {
    const firstImage = media.find(m => m.media_type === 'image');
    savedCoverPreviewUrl = firstImage?.thumbnail_url ?? null;
  }

  return (
    <PhotosPageClient
      eventId={eventId}
      eventName={event.name}
      media={media}
      albums={albums}
      event={event}
      savedCoverPreviewUrl={savedCoverPreviewUrl}
    />
  );
}
