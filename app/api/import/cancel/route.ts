import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await request.json();
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify ownership and that the job is still active
  const { data: job } = await supabase
    .from('import_jobs')
    .select('id, status')
    .eq('id', jobId)
    .eq('organizer_id', organizer.id)
    .in('status', ['pending', 'listing', 'processing'])
    .single();

  if (!job) {
    return NextResponse.json(
      { error: 'Import job not found or already completed' },
      { status: 404 },
    );
  }

  const { error } = await supabase
    .from('import_jobs')
    .update({ cancelled: true, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to cancel import job:', error);
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
