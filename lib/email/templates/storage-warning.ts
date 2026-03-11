interface StorageWarningData {
  name: string | null;
  usedDisplay: string;
  limitDisplay: string;
  overByDisplay: string;
  deadlineDate: string;
  planName: string;
}

export function storageWarningSubject(): string {
  return 'Your PIXTRACE content will be deleted tomorrow';
}

export function storageWarningHtml(data: StorageWarningData): string {
  const greeting = data.name ? `Hi ${data.name},` : 'Hi there,';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="background:#dc2626;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">PIXTRACE</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        ${greeting}
      </p>

      <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
        Your storage usage (<strong>${data.usedDisplay}</strong>) exceeds your
        <strong>${data.planName}</strong> plan limit (<strong>${data.limitDisplay}</strong>)
        by <strong>${data.overByDisplay}</strong>.
      </p>

      <!-- Alert box -->
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;">
        <p style="margin:0;color:#991b1b;font-size:14px;font-weight:600;">
          Your oldest events will be automatically deleted on ${data.deadlineDate} unless you take action.
        </p>
      </div>

      <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
        To prevent any data loss, you can:
      </p>

      <!-- CTA buttons -->
      <div style="text-align:center;margin:0 0 16px;">
        <a href="https://pixtrace.in/pricing"
           style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          Upgrade Your Plan
        </a>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="https://pixtrace.in/dashboard"
           style="color:#6b7280;text-decoration:underline;font-size:13px;">
          Or manage your content
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

      <!-- Safety message -->
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
        If you&apos;ve already upgraded and received this email by mistake, please don&apos;t worry &mdash;
        your content is safe. The system will automatically detect the upgrade and cancel the deletion.
        If you have any concerns, contact us at
        <a href="mailto:support@pixtrace.in" style="color:#2563eb;">support@pixtrace.in</a>
        and we&apos;ll make sure nothing is deleted.
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
