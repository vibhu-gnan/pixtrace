import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';

/**
 * Tell the organizer a guest asked for a photo to come down.
 *
 * Returns whether the mail actually went out, so the caller only stamps the request as
 * notified on success and the cron can retry the rest. Never throws: the photo is
 * already hidden by the time this runs, and a mail failure must not undo that.
 */
export async function sendTakedownRequestEmail(input: {
  eventId: string;
  eventName: string;
  eventHash: string;
  filename: string | null;
  reason: string | null;
  requesterEmail: string | null;
}): Promise<boolean> {
  const { eventId, eventName, filename, reason, requesterEmail } = input;

  try {
    const supabase = createAdminClient();

    const { data: event } = await supabase
      .from('events')
      .select('organizer_id, organizers(name, email)')
      .eq('id', eventId)
      .single();

    const organizer = (event as unknown as { organizers?: { name: string | null; email: string | null } })
      ?.organizers;

    if (!organizer?.email) {
      console.warn(`[TakedownEmail] No email for the owner of event ${eventId}. Skipping.`);
      return false;
    }

    const { takedownRequestSubject, takedownRequestHtml } = await import(
      '@/lib/email/templates/takedown-request'
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pixtrace.in';

    return await sendEmail({
      to: organizer.email,
      subject: takedownRequestSubject(eventName),
      html: takedownRequestHtml({
        name: organizer.name,
        eventName,
        filename,
        reason,
        requesterEmail,
        hoursToDecide: 6,
        reviewUrl: `${appUrl}/events/${eventId}/takedowns`,
      }),
      emailType: 'takedown_request',
    });
  } catch (err) {
    console.error('[TakedownEmail] Unexpected failure:', err);
    return false;
  }
}
