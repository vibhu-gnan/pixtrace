import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySecret } from '@/lib/security/verify-secret';

/**
 * Stale job cleanup endpoint.
 * Marks import jobs stuck in pending/listing/processing for >30 minutes as failed.
 * Can be called by a cron job or manually by an admin.
 */
export async function POST(request: NextRequest) {
  // Verify with a shared secret (reuse FACE_PROCESSING_SECRET)
  const secret = request.headers.get('x-cleanup-secret');
  const expected = process.env.FACE_PROCESSING_SECRET;

  if (!verifySecret(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find jobs stuck for more than 30 minutes
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: staleJobs, error } = await supabase
    .from('import_jobs')
    .select('id, status, updated_at')
    .in('status', ['pending', 'listing', 'processing'])
    .lt('updated_at', staleThreshold);

  if (error) {
    console.error('Stale job query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!staleJobs || staleJobs.length === 0) {
    return NextResponse.json({ cleaned: 0 });
  }

  const staleIds = staleJobs.map((j) => j.id);

  const { error: updateErr } = await supabase
    .from('import_jobs')
    .update({
      status: 'failed',
      error_message: 'Import timed out. Please try again.',
      updated_at: new Date().toISOString(),
    })
    .in('id', staleIds);

  if (updateErr) {
    console.error('Stale job update error:', updateErr);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  console.log(`[Cleanup] Marked ${staleIds.length} stale import jobs as failed`);
  return NextResponse.json({ cleaned: staleIds.length, jobIds: staleIds });
}
