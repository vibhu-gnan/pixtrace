import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from('import_jobs')
    .select(
      'id, status, total_files, completed, failed, skipped, error_message, import_mode, completed_at, created_at',
    )
    .eq('id', jobId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Import job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
