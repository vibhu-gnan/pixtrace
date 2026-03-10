import { getMediaPage, getMediaCount } from '@/actions/media';
import { getAlbums } from '@/actions/albums';
import { getEvent } from '@/actions/events';
import { PhotosPageClient } from '@/components/event/photos-page-client';
import { notFound } from 'next/navigation';
import { getSignedR2Url } from '@/lib/storage/r2-client';


export default async function PhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await getEvent(eventId);
  if (!event) notFound();

  const [{ media, hasMore }, albums, counts] = await Promise.all([
    getMediaPage(eventId),
    getAlbums(eventId),
    getMediaCount(eventId),
  ]);

  // Resolve logo URL server-side (R2 key → signed URL)
  const logoRaw = (event.theme as any)?.logoUrl as string | undefined;
  const resolvedLogoUrl = logoRaw
    ? (logoRaw.startsWith('http://') || logoRaw.startsWith('https://') ? logoRaw : await getSignedR2Url(logoRaw))
    : null;

  // Compute cover preview URL server-side
  let savedCoverPreviewUrl: string | null = null;
  if (event.cover_media_id) {
    const found = media.find(m => m.id === event.cover_media_id);
    savedCoverPreviewUrl = found?.preview_url ?? null;
  }
  if (!savedCoverPreviewUrl && media.length > 0) {
    const firstImage = media.find(m => m.media_type === 'image');
    savedCoverPreviewUrl = firstImage?.preview_url ?? null;
  }

  return (
    <PhotosPageClient
      eventId={eventId}
      eventName={event.name}
      media={media}
      albums={albums}
      event={event}
      savedCoverPreviewUrl={savedCoverPreviewUrl}
      logoUrl={resolvedLogoUrl}
      initialHasMore={hasMore}
      totalPhotos={counts.photos}
      totalVideos={counts.videos}
    />
  );
}
