import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicClient } from '@/lib/supabase/public';
import { FACE_SEARCH } from '@/lib/face/constants';

// Creates an async face search job and returns immediately.
// Modal cron processes the job within ~60s and writes results to face_search_jobs.
// Client polls /api/face/poll/[jobId] for status and results.
// This keeps the route well within Vercel Free's 10s function limit.

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const selfie = formData.get('selfie') as File | null;
    const eventHash = formData.get('eventHash') as string | null;
    const albumId = formData.get('albumId') as string | null;

    if (!selfie || !eventHash) {
      return NextResponse.json(
        { error: 'Missing selfie or eventHash' },
        { status: 400 },
      );
    }

    if (!selfie.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Selfie must be an image' },
        { status: 400 },
      );
    }
    if (selfie.size > FACE_SEARCH.MAX_SELFIE_SIZE) {
      return NextResponse.json(
        { error: 'Selfie too large (max 5MB)' },
        { status: 400 },
      );
    }

    // Resolve event (must be public)
    const publicClient = getPublicClient();
    const { data: eventData } = await publicClient
      .from('events')
      .select('id, name, is_public')
      .eq('event_hash', eventHash)
      .eq('is_public', true)
      .single();

    if (!eventData) {
      return NextResponse.json(
        { error: 'Event not found or not public' },
        { status: 404 },
      );
    }

    // Extract auth user for face profile saving (optional — recall feature)
    const adminClient = createAdminClient();
    let authUserId: string | null = null;
    let authUserEmail: string | null = null;
    let authUserName: string | null = null;

    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (user) {
        authUserId = user.id;
        authUserEmail = user.email || null;
        authUserName = user.user_metadata?.full_name || user.user_metadata?.name || null;
      }
    }

    // Convert selfie to base64 for storage
    const selfieBuffer = await selfie.arrayBuffer();
    const selfieBase64 = Buffer.from(selfieBuffer).toString('base64');

    // Create the job — Modal cron will pick it up within ~60s
    const { data: job, error: insertError } = await adminClient
      .from('face_search_jobs')
      .insert({
        event_id: (eventData as { id: string }).id,
        album_id: albumId || null,
        selfie_data: selfieBase64,
        auth_user_id: authUserId,
        auth_user_email: authUserEmail,
        auth_user_name: authUserName,
      })
      .select('id')
      .single();

    if (insertError || !job) {
      console.error('Failed to create face search job:', insertError);
      return NextResponse.json(
        { error: 'Failed to create search job' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      job_id: job.id,
      status: 'pending',
    });
  } catch (error) {
    console.error('Face search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
