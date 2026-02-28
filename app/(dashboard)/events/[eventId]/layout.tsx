import { notFound } from 'next/navigation';
import { getEvent } from '@/actions/events';
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
  const event = await getEvent(eventId);

  if (!event) {
    notFound();
  }

  // Compute cover preview URL for sidebar display
  let coverPreviewUrl: string | null = null;
  if (event.cover_media_id) {
    const supabase = createAdminClient();
    const { data: mediaRow } = await supabase
      .from('media')
      .select('r2_key, preview_r2_key')
      .eq('id', event.cover_media_id)
      .single();
    if (mediaRow) {
      coverPreviewUrl = await getPreviewUrl(mediaRow.r2_key, mediaRow.preview_r2_key);
    }
  }

  return (
    <EventLayoutShell event={event} coverPreviewUrl={coverPreviewUrl}>
      {children}
    </EventLayoutShell>
  );
}
