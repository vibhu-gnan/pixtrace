import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Use verified domain in production, Resend's test address in dev
const FROM_ADDRESS = process.env.NODE_ENV === 'production'
  ? 'PIXTRACE <noreply@pixtrace.in>'
  : 'PIXTRACE <onboarding@resend.dev>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  emailType?: string;
}

/** Fire-and-forget: log email to DB for admin visibility */
function logEmail(
  recipient: string,
  subject: string,
  emailType: string,
  status: 'sent' | 'failed' | 'skipped',
  error?: string,
) {
  import('@/lib/supabase/admin')
    .then(({ createAdminClient }) => {
      const supabase = createAdminClient();
      return supabase.from('email_logs').insert({
        recipient: recipient.slice(0, 320),
        subject: subject.slice(0, 500),
        email_type: emailType.slice(0, 50),
        status,
        error: error ? error.slice(0, 1000) : null,
      });
    })
    .then(({ error: dbErr }) => {
      if (dbErr) console.error('[Email] Failed to log email:', dbErr.message);
    })
    .catch((err) => {
      console.error('[Email] Failed to log email:', err);
    });
}

/**
 * Send a transactional email via Resend.
 *
 * Returns true if the email was sent (or skipped in dev without API key).
 * Returns false if sending failed — callers should NOT mark the
 * notification as sent so it can be retried on the next cron run.
 */
export async function sendEmail({ to, subject, html, emailType = 'unknown' }: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not configured — skipping email');
    return false;
  }

  // Skip fake emails from OAuth fallback
  if (to.endsWith('@noemail.pixtrace.in')) {
    console.log(`[Email] Skipping fake email address: ${to}`);
    logEmail(to, subject, emailType, 'skipped', 'Fake OAuth email');
    return true; // Not an error — just nothing to send
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`[Email] Resend API error sending to ${to}:`, error);
      logEmail(to, subject, emailType, 'failed', error.message);
      return false;
    }

    console.log(`[Email] Sent "${subject}" to ${to}`);
    logEmail(to, subject, emailType, 'sent');
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err);
    logEmail(to, subject, emailType, 'failed', String(err));
    return false;
  }
}
