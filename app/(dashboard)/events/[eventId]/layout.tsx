import { notFound } from 'next/navigation';
import { getEvent } from '@/actions/events';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getOrganizerPlanLimits } from '@/lib/plans/limits';
import { EventLayoutShell } from '@/components/event/event-layout-shell';
import { getOriginalUrl, getPreviewUrl } from '@/lib/storage/cloudflare-images';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [event, organizer] = await Promise.all([
    getEvent(eventId),
    getCurrentOrganizer(),
  ]);

  if (!event) {
    notFound();
  }

  // Fetch plan limits and cover preview in parallel
  const [planLimits, coverPreviewUrl] = await Promise.all([
    organizer ? getOrganizerPlanLimits(organizer.id) : null,
    (async () => {
      if (event.cover_media_id) {
        const supabase = createAdminClient();
        const { data: mediaRow } = await supabase
          .from('media')
          .select('r2_key, preview_r2_key')
          .eq('id', event.cover_media_id)
          .single();
        if (mediaRow) {
          return getPreviewUrl(mediaRow.r2_key, mediaRow.preview_r2_key);
        }
      }
      return null;
    })(),
  ]);

  return (
    <EventLayoutShell event={event} coverPreviewUrl={coverPreviewUrl} planLimits={planLimits}>
      {children}
    </EventLayoutShell>
  );
}
