import { notFound } from 'next/navigation';
import { getEvent } from '@/actions/events';
import { DeleteEventButton } from '@/components/dashboard/delete-event-button';
import { EditEventDetails } from '@/components/dashboard/edit-event-details';
import { QRCodeGenerator } from '@/components/dashboard/qr-code-generator';
import { EventLinkActions } from '@/components/event/event-link-actions';
import { HeroCoverSettings } from '@/components/dashboard/hero-cover-settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { getThumbnailUrl, getPreviewUrl, getOriginalUrl } from '@/lib/storage/cloudflare-images'; // For mapping media

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEvent(eventId);

  if (!event) {
    notFound();
  }

  // Fetch full media list for selectors
  const supabase = createAdminClient();
  const { data: mediaRows } = await supabase
    .from('media')
    .select('id, r2_key, preview_r2_key, media_type, original_filename')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  // Map to GalleryMediaItem shape expected by component
  const allMedia = (mediaRows || []).map((m: any) => ({
    id: m.id,
    album_id: '', // Not needed for selector display mostly, but interface requires it
    album_name: '',
    original_filename: m.original_filename,
    media_type: m.media_type,
    width: 0,
    height: 0,
    thumbnail_url: m.media_type === 'image' ? getThumbnailUrl(m.r2_key, 200, m.preview_r2_key) : '',
    blur_url: '',
    full_url: '',
    original_url: '',
  }));

  if (!event) {
    notFound();
  }

  const galleryUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/gallery/${event.event_hash}`;

  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
    : '\u2014';

  const formattedCreatedAt = event.created_at
    ? new Date(event.created_at).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : '\u2014';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <DeleteEventButton eventId={eventId} eventName={event.name} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Column */}
        <div className="lg:col-span-2 space-y-8">

          {/* Hero Cover Settings */}
          <section>
            <HeroCoverSettings
              event={event}
              media={allMedia}
              albums={event.albums || []}
            />
          </section>

          {/* Event Details */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
              <EditEventDetails
                eventId={eventId}
                name={event.name}
                description={event.description}
                eventDate={event.event_date}
                isPublic={event.is_public}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Name</p>
                <p className="text-base text-gray-900">{event.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Date</p>
                <p className="text-base text-gray-900">{formattedDate}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Venue</p>
                <p className="text-base text-gray-900">{event.description || '\u2014'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Level</p>
                <p className="text-base text-gray-900">{event.is_public ? 'Public' : 'Private'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event created on</p>
                <p className="text-base text-gray-900">{formattedCreatedAt}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Status</p>
                <p className="text-base text-gray-900">
                  {event.is_public ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      Not Live
                    </span>
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Event Link / QR — sidebar column */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Link</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <QRCodeGenerator url={galleryUrl} eventName={event.name} />

            <EventLinkActions galleryUrl={galleryUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
