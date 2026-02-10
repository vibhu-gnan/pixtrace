import { getMedia } from '@/actions/media';
import { getAlbums } from '@/actions/albums';
import { getEvent } from '@/actions/events';
import { PhotosPageClient } from '@/components/event/photos-page-client';
import { notFound } from 'next/navigation';

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

  return (
    <PhotosPageClient
      eventId={eventId}
      eventName={event.name}
      media={media}
      albums={albums}
    />
  );
}
