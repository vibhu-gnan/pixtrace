import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const eventHash = request.nextUrl.searchParams.get('eventHash');
    if (!eventHash) {
      return NextResponse.json({ error: 'Missing eventHash' }, { status: 400 });
    }

    // Verify auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ has_profile: false });
    }

    const adminClient = createAdminClient();
    const token = authHeader.slice(7);
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ has_profile: false });
    }

    // Resolve event
    const { data: eventData } = await adminClient
      .from('events')
      .select('id')
      .eq('event_hash', eventHash)
      .eq('is_public', true)
      .single();

    if (!eventData) {
      return NextResponse.json({ has_profile: false });
    }

    // Look up gallery_user + face_search_profile
    const { data: galleryUser } = await adminClient
      .from('gallery_users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!galleryUser) {
      return NextResponse.json({ has_profile: false });
    }

    const { data: profile } = await adminClient
      .from('face_search_profiles')
      .select('match_count, updated_at')
      .eq('gallery_user_id', galleryUser.id)
      .eq('event_id', eventData.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ has_profile: false });
    }

    return NextResponse.json({
      has_profile: true,
      match_count: profile.match_count,
      updated_at: profile.updated_at,
    });
  } catch (error) {
    console.error('Face profile check error:', error);
    return NextResponse.json({ has_profile: false });
  }
}
