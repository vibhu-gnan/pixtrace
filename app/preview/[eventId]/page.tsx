import { redirect, notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getEvent } from '@/actions/events';
import { DevicePreviewClient } from '@/components/preview/device-preview-client';

type Props = {
    params: Promise<{ eventId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    try {
        const { eventId } = await params;
        const organizer = await getCurrentOrganizer();
        if (!organizer) return { title: 'Preview' };

        const event = await getEvent(eventId);
        if (!event) return { title: 'Preview' };

        return {
            title: `Preview: ${event.name} | PIXTRACE`,
        };
    } catch {
        return { title: 'Preview | PIXTRACE' };
    }
}

export default async function DevicePreviewPage({ params }: Props) {
    const organizer = await getCurrentOrganizer();
    if (!organizer) {
        redirect('/sign-in');
    }

    const { eventId } = await params;
    const event = await getEvent(eventId);

    if (!event) {
        notFound();
    }

    return (
        <DevicePreviewClient
            eventId={event.id}
            eventName={event.name}
            eventHash={event.event_hash}
            isPublished={event.is_public}
        />
    );
}
