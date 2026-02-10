import { notFound } from 'next/navigation';
import { getEvent } from '@/actions/events';
import { EventLayoutShell } from '@/components/event/event-layout-shell';

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await getEvent(eventId);

  if (!event) {
    notFound();
  }

  return <EventLayoutShell event={event}>{children}</EventLayoutShell>;
}
