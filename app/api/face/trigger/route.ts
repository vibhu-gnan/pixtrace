import { NextRequest, NextResponse } from 'next/server';
import { runTrigger } from '@/lib/face/run-trigger';
import crypto from 'crypto';

export const maxDuration = 60; // 1 min — trigger only dispatches; Modal updates Supabase directly

function verifyAuth(request: NextRequest): boolean {
  // Accept two auth methods:
  //   1. X-Face-Secret header — used by manual/external callers (POST)
  //   2. Authorization: Bearer <CRON_SECRET> — used by Vercel cron scheduler (GET)
  const faceSecret = request.headers.get('X-Face-Secret') || '';
  const authHeader = request.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const expectedFaceSecret = process.env.FACE_PROCESSING_SECRET || '';
  const expectedCronSecret = process.env.CRON_SECRET || '';

  const isValidFaceSecret =
    expectedFaceSecret &&
    faceSecret.length === expectedFaceSecret.length &&
    crypto.timingSafeEqual(Buffer.from(faceSecret), Buffer.from(expectedFaceSecret));

  const isValidCronSecret =
    expectedCronSecret &&
    bearerToken.length === expectedCronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(bearerToken), Buffer.from(expectedCronSecret));

  return !!(isValidFaceSecret || isValidCronSecret);
}

// GET — called by Vercel cron every day
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runTrigger();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}

// POST — called manually or from external tools
export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runTrigger();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 });
  }
}
