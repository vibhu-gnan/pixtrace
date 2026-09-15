import { NextRequest, NextResponse } from 'next/server';
import { verifySecret } from '@/lib/security/verify-secret';
import { runTakedownMaintenance } from '@/lib/takedowns/maintenance';
import { captureError } from '@/lib/monitoring/sentry';

/**
 * GET|POST /api/cron/takedown-maintenance
 *
 * Takedown housekeeping, for manual or external invocation. It is deliberately NOT in
 * vercel.json: this plan allows only two cron jobs, and adding a third made Vercel
 * reject the deployment outright rather than fail a build. The same work runs daily
 * from /api/cron/storage-cleanup instead.
 *
 * Restoring photos after the 6-hour window is not here and needs no schedule — it is a
 * timestamp on the row, so the photo reappears whether or not anything runs.
 *
 * Protected by CRON_SECRET (Bearer token in Authorization header).
 */
export const GET = handler;
export const POST = handler;

async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    captureError(new Error('CRON_SECRET not configured'), {
      source: 'takedown-maintenance',
      level: 'fatal',
    });
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!verifySecret(bearerToken, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await runTakedownMaintenance());
}
