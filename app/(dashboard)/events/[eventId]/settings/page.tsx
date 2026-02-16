import { EventLogoSettings } from '@/components/dashboard/event-logo-settings';
import { notFound } from 'next/navigation';

import Link from 'next/link';
import { getEvent } from '@/actions/events';
import { DeleteEventButton } from '@/components/dashboard/delete-event-button';
import { EditEventDetails } from '@/components/dashboard/edit-event-details';
import { QRCodeGenerator } from '@/components/dashboard/qr-code-generator';
import { EventLinkActions } from '@/components/event/event-link-actions';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const eventData = await getEvent(eventId);

  if (!eventData) {
    notFound();
    return null;
  }

  const galleryUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/gallery/${eventData.event_hash}`;

  const startDate = eventData.event_date ? new Date(eventData.event_date) : null;
  const endDate = eventData.event_end_date ? new Date(eventData.event_end_date) : null;

  let formattedDate = '\u2014';
  if (startDate) {
    if (endDate) {
      formattedDate = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} \u2013 ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      formattedDate = startDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }

  const formattedCreatedAt = eventData.created_at
    ? new Date(eventData.created_at).toLocaleDateString('en-US', {
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
        <DeleteEventButton eventId={eventId} eventName={eventData.name} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Column */}
        <div className="lg:col-span-2 space-y-8">

          {/* Gallery Cover — redirects to Photos page */}
          <section>
            <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Gallery Cover</h2>
                <p className="text-sm text-gray-500">
                  Cover photo settings are now managed from the Photos page.
                </p>
              </div>
              <Link
                href={`/events/${eventId}/photos`}
                className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                Go to Photos
              </Link>
            </div>
          </section>

          {/* Logo Settings */}
          <section>
            <EventLogoSettings
              eventId={eventData.id}
              initialLogoUrl={(eventData.theme as any)?.logoUrl}
              initialLogoDisplay={(eventData.theme as any)?.logoDisplay}
            />
          </section>

          {/* Event Details */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
              <EditEventDetails
                eventId={eventId}
                name={eventData.name}
                description={eventData.description}
                eventDate={eventData.event_date}
                eventEndDate={eventData.event_end_date}
                isPublic={eventData.is_public}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Name</p>
                <p className="text-base text-gray-900">{eventData.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Date</p>
                <p className="text-base text-gray-900">{formattedDate}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Venue</p>
                <p className="text-base text-gray-900">{eventData.description || '\u2014'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Level</p>
                <p className="text-base text-gray-900">{eventData.is_public ? 'Public' : 'Private'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event created on</p>
                <p className="text-base text-gray-900">{formattedCreatedAt}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Gallery Views</p>
                <p className="text-base text-gray-900">{(eventData.view_count || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Event Status</p>
                <p className="text-base text-gray-900">
                  {eventData.is_public ? (
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
            <QRCodeGenerator url={galleryUrl} eventName={eventData.name} />

            <EventLinkActions galleryUrl={galleryUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
