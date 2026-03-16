interface PlanChangeEmailData {
  name: string | null;
  direction: 'upgrade' | 'downgrade';
  oldPlanName: string;
  newPlanName: string;
  oldStorage: string;
  newStorage: string;
  oldMaxEvents: string;
  newMaxEvents: string;
  features?: string[];
}

/** Prevent XSS — user names are free-text input */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function planChangeSubject(direction: 'upgrade' | 'downgrade'): string {
  return direction === 'upgrade'
    ? 'Your PIXTRACE plan has been upgraded!'
    : 'Your PIXTRACE plan has been changed';
}

export function planChangeHtml(data: PlanChangeEmailData): string {
  const safeName = data.name ? escapeHtml(data.name) : null;
  const greeting = safeName ? `Hi ${safeName},` : 'Hi there,';
  const isUpgrade = data.direction === 'upgrade';
  const headerBg = isUpgrade ? '#2563eb' : '#d97706';
  const accentBg = isUpgrade ? '#f0f7ff' : '#fffbeb';
  const accentBorder = isUpgrade ? '#dbeafe' : '#fef3c7';
  const ctaColor = isUpgrade ? '#2563eb' : '#d97706';

  const featuresHtml = data.features?.length
    ? data.features
        .map(
          (f) =>
            `<tr>
          <td style="padding:4px 8px 4px 0;vertical-align:top;width:20px;color:${ctaColor};font-size:14px;">${isUpgrade ? '&#10003;' : '&bull;'}</td>
          <td style="padding:4px 0;font-size:13px;color:#374151;line-height:1.4;">${escapeHtml(f)}</td>
        </tr>`,
        )
        .join('')
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="background:${headerBg};padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">PIXTRACE</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        ${greeting}
      </p>

      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        ${
          isUpgrade
            ? `Great news! Your plan has been upgraded from <strong>${escapeHtml(data.oldPlanName)}</strong> to <strong>${escapeHtml(data.newPlanName)}</strong>.`
            : `Your plan has been changed from <strong>${escapeHtml(data.oldPlanName)}</strong> to <strong>${escapeHtml(data.newPlanName)}</strong>.`
        }
      </p>

      <!-- Plan comparison -->
      <div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:8px;padding:16px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
          <tr style="border-bottom:1px solid ${accentBorder};">
            <td style="padding:8px 0;font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;"></td>
            <td style="padding:8px 0;text-align:center;font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Before</td>
            <td style="padding:8px 0;width:30px;"></td>
            <td style="padding:8px 0;text-align:center;font-weight:600;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Now</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:500;">Storage</td>
            <td style="padding:8px 0;text-align:center;color:#6b7280;">${escapeHtml(data.oldStorage)}</td>
            <td style="padding:8px 0;text-align:center;color:#9ca3af;">&rarr;</td>
            <td style="padding:8px 0;text-align:center;font-weight:600;color:${ctaColor};">${escapeHtml(data.newStorage)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:500;">Events</td>
            <td style="padding:8px 0;text-align:center;color:#6b7280;">${escapeHtml(data.oldMaxEvents)}</td>
            <td style="padding:8px 0;text-align:center;color:#9ca3af;">&rarr;</td>
            <td style="padding:8px 0;text-align:center;font-weight:600;color:${ctaColor};">${escapeHtml(data.newMaxEvents)}</td>
          </tr>
        </table>
      </div>

      ${
        featuresHtml
          ? `
      <!-- Features -->
      <p style="margin:0 0 8px;color:#374151;font-size:13px;font-weight:600;">
        ${isUpgrade ? 'You now have access to:' : 'Your plan includes:'}
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        ${featuresHtml}
      </table>
      `
          : ''
      }

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${isUpgrade ? 'https://pixtrace.in/dashboard' : 'https://pixtrace.in/pricing'}"
           style="display:inline-block;background:${ctaColor};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          ${isUpgrade ? 'Explore Your Dashboard' : 'View Plans'}
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
        Questions about your plan? Contact us at
        <a href="mailto:support@pixtrace.in" style="color:#2563eb;">support@pixtrace.in</a>.
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
