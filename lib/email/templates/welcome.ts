interface WelcomeEmailData {
  name: string | null;
}

/** Prevent XSS — user names are free-text input */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function welcomeSubject(): string {
  return 'Welcome to PIXTRACE! Let\u2019s set up your first event';
}

export function welcomeHtml(data: WelcomeEmailData): string {
  const safeName = data.name ? escapeHtml(data.name) : null;
  const greeting = safeName ? `Hi ${safeName},` : 'Hi there,';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="background:#2563eb;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">PIXTRACE</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        ${greeting}
      </p>

      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        Welcome to PIXTRACE &mdash; the easiest way to share event photos with your clients.
        Your account is ready. Here&apos;s what you can do:
      </p>

      <!-- Feature highlights -->
      <div style="background:#f0f7ff;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
          <tr>
            <td style="padding:6px 12px 6px 0;vertical-align:top;width:24px;color:#2563eb;font-size:16px;">&#10003;</td>
            <td style="padding:6px 0;line-height:1.5;">Upload original-quality photos (up to 48MP)</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;vertical-align:top;width:24px;color:#2563eb;font-size:16px;">&#10003;</td>
            <td style="padding:6px 0;line-height:1.5;">Share instantly via QR code &mdash; no app needed</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;vertical-align:top;width:24px;color:#2563eb;font-size:16px;">&#10003;</td>
            <td style="padding:6px 0;line-height:1.5;">Organize with albums, face search &amp; custom branding</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 16px;">
        <a href="https://pixtrace.in/events/new"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          Create Your First Event
        </a>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="https://pixtrace.in/dashboard"
           style="color:#6b7280;text-decoration:underline;font-size:13px;">
          Or explore your dashboard
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
        Questions? Just reply to this email or reach us at
        <a href="mailto:support@pixtrace.in" style="color:#2563eb;">support@pixtrace.in</a>.
        We&apos;re happy to help you get started.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
        PIXTRACE &middot; Event Photo Gallery for Photographers
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
