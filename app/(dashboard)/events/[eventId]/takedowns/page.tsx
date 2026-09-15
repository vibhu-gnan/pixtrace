import { getEvent } from '@/actions/events';
import { getTakedownRequests } from '@/actions/takedowns';
import { notFound } from 'next/navigation';
import TakedownList from './takedown-list';

// Requests expire on a clock, so this page must never be served stale.
export const dynamic = 'force-dynamic';

export default async function TakedownsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEvent(eventId);

  if (!event) {
    notFound();
  }

  const requests = await getTakedownRequests(eventId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Removal requests</h1>
      <p className="text-sm text-gray-500 mb-8">
        Guests can ask for a photo of themselves to be taken down. The photo is hidden while
        you decide, and goes back up on its own if you do not act in time.
      </p>

      <TakedownList eventId={eventId} requests={requests} />
    </div>
  );
}
