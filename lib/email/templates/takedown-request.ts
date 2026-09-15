interface TakedownRequestData {
  name: string | null;
  eventName: string;
  filename: string | null;
  reason: string | null;
  requesterEmail: string | null;
  hoursToDecide: number;
  reviewUrl: string;
}

export function takedownRequestSubject(eventName: string): string {
  return `Photo removal requested — ${eventName}`;
}

export function takedownRequestHtml(data: TakedownRequestData): string {
  const greeting = data.name ? `Hi ${data.name},` : 'Hi there,';
  const photo = data.filename ? `<strong>${escapeHtml(data.filename)}</strong>` : 'a photo';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="background:#4f46e5;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">PIXTRACE</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        ${greeting}
      </p>

      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        A guest asked you to remove ${photo} from
        <strong>${escapeHtml(data.eventName)}</strong>.
      </p>

      <!-- Status box -->
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;margin:0 0 24px;">
        <p style="margin:0;color:#3730a3;font-size:14px;font-weight:600;">
          The photo is hidden from the gallery right now.
        </p>
        <p style="margin:8px 0 0;color:#4338ca;font-size:14px;line-height:1.5;">
          If you do nothing, it goes back up automatically in ${data.hoursToDecide} hours.
        </p>
      </div>

      ${data.reason ? `
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">
        Their reason
      </p>
      <div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;margin:0 0 24px;">
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">
          ${escapeHtml(data.reason)}
        </p>
      </div>` : ''}

      <!-- CTA -->
      <div style="margin:0 0 24px;">
        <a href="${data.reviewUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">
          Review the request
        </a>
      </div>

      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
        Approving hides the photo for good and deletes it after 30 days. Declining puts it
        straight back in the gallery.${data.requesterEmail ? ` Requested by ${escapeHtml(data.requesterEmail)}.` : ''}
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;">
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
        You are receiving this because someone requested a photo removal from your gallery.
      </p>
    </div>

  </div>
</body>
</html>`;
}

/** Guest-supplied text lands in this email, so it must never be able to inject markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
