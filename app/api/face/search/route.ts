import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicClient } from '@/lib/supabase/public';
import { FACE_SEARCH } from '@/lib/face/constants';

// Creates an async face search job and returns immediately.
// Modal cron processes the job within ~60s and writes results to face_search_jobs.
// Client polls /api/face/poll/[jobId] for status and results.
// This keeps the route well within Vercel Free's 10s function limit.

// ── IP-based sliding window rate limiter ─────────────────────────────────────
// Prevents GPU cost abuse on the face search endpoint.
// Same pattern as app/api/import/drive/route.ts.
const searchTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SEARCHES_PER_WINDOW = 3;
const MAX_RATE_LIMIT_ENTRIES = 5000;

export async function POST(request: NextRequest) {
  const adminClient = createAdminClient();

  // ── Resolve auth user first — authenticated users bypass rate limiting ───────
  // Organizers pass their Supabase JWT; we verify it here once and reuse the
  // result below for face profile saving, so there's no extra DB round-trip.
  let authUserId: string | null = null;
  let authUserEmail: string | null = null;
  let authUserName: string | null = null;
  let isAuthenticated = false;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data: { user } } = await adminClient.auth.getUser(token);
    if (user) {
      authUserId = user.id;
      authUserEmail = user.email || null;
      authUserName = user.user_metadata?.full_name || user.user_metadata?.name || null;
      isAuthenticated = true;
    }
  }

  // ── Rate limit check (anonymous requests only) ───────────────────────────────
  // Authenticated organizers/users are exempt — they have a verified account
  // and are not the abuse vector this is defending against.
  if (!isAuthenticated) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = (forwarded ? forwarded.split(',')[0].trim() : null)
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';

    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const recentTimestamps = (searchTimestamps.get(ip) ?? []).filter(t => t > windowStart);

    if (recentTimestamps.length >= MAX_SEARCHES_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Too many face searches. Please wait a few minutes.' },
        { status: 429, headers: { 'Retry-After': '300' } },
      );
    }

    recentTimestamps.push(now);
    searchTimestamps.set(ip, recentTimestamps);

    // Evict stale entries to prevent unbounded map growth
    if (searchTimestamps.size > MAX_RATE_LIMIT_ENTRIES) {
      for (const [key, timestamps] of searchTimestamps) {
        if (timestamps.every(t => t <= windowStart)) {
          searchTimestamps.delete(key);
        }
      }
    }
  }

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

    // Convert selfie to base64 for storage
    const selfieBuffer = await selfie.arrayBuffer();
    const selfieBase64 = Buffer.from(selfieBuffer).toString('base64');

    // Generate a poll token — clients must supply this when polling (IDOR prevention)
    const pollToken = crypto.randomBytes(32).toString('base64url');

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
        poll_token: pollToken,
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
      poll_token: pollToken,
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
