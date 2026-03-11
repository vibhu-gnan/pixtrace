interface StorageDeletedData {
  name: string | null;
  eventsDeleted: number;
  bytesFreedDisplay: string;
  currentUsageDisplay: string;
  limitDisplay: string;
  planName: string;
}

export function storageDeletedSubject(eventsDeleted: number): string {
  return `${eventsDeleted} event${eventsDeleted !== 1 ? 's' : ''} removed from your PIXTRACE account`;
}

export function storageDeletedHtml(data: StorageDeletedData): string {
  const greeting = data.name ? `Hi ${data.name},` : 'Hi there,';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="background:#1f2937;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">PIXTRACE</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        ${greeting}
      </p>

      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        Your storage grace period expired and we&apos;ve automatically cleaned up content
        to bring your account within your <strong>${data.planName}</strong> plan limit.
      </p>

      <!-- Summary box -->
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:0 0 24px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
          <tr>
            <td style="padding:4px 0;">Events removed</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;">${data.eventsDeleted}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;">Storage freed</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;">${data.bytesFreedDisplay}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px 0 4px;">Current usage</td>
            <td style="padding:8px 0 4px;text-align:right;font-weight:600;">${data.currentUsageDisplay} / ${data.limitDisplay}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
        The oldest events were removed first. To prevent this from happening again,
        consider upgrading your plan for more storage.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 24px;">
        <a href="https://pixtrace.in/pricing"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          Upgrade for More Storage
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

      <!-- Safety message -->
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
        If you had already upgraded your plan and content was still removed, please contact us
        immediately at <a href="mailto:support@pixtrace.in" style="color:#2563eb;">support@pixtrace.in</a>.
        We keep backups and can help recover your data.
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
