import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getOrganizerPlanLimits, canUpload } from '@/lib/plans/limits';

/**
 * POST /api/upload/check-storage
 *
 * Lightweight pre-flight check: does the organizer have enough storage
 * for the total size of files they're about to upload?
 *
 * Body: { totalSizeBytes: number }
 * Returns: { allowed, reason?, storageUsedBytes, storageLimitBytes, planName }
 */
export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { totalSizeBytes } = body;
  if (typeof totalSizeBytes !== 'number' || totalSizeBytes <= 0 || !Number.isFinite(totalSizeBytes)) {
    return NextResponse.json({ error: 'Invalid totalSizeBytes' }, { status: 400 });
  }

  const limits = await getOrganizerPlanLimits(organizer.id);
  const check = canUpload(limits, totalSizeBytes);

  return NextResponse.json({
    allowed: check.allowed,
    reason: check.reason || null,
    storageUsedBytes: limits.storageUsedBytes,
    storageLimitBytes: limits.storageLimitBytes,
    planName: limits.planName,
    planId: limits.planId,
  });
}
