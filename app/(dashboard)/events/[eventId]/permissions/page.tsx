import { getEvent, updateEventPermissions } from '@/actions/events';
import { notFound } from 'next/navigation';
import PermissionsForm from './permissions-form';

export default async function PermissionsPage({ params }: { params: { eventId: string } }) {
  const event = await getEvent(params.eventId);

  if (!event) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Permissions</h1>

      <PermissionsForm
        eventId={event.id}
        initialAllowDownload={event.allow_download ?? true}
        initialAllowSlideshow={event.allow_slideshow ?? true}
      />
    </div>
  );
}
