import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicClient } from '@/lib/supabase/public';

// Serves the stored face embeddings for a set of matched media so the client can
// re-rank the face-search review queue locally (see lib/face/client-rerank.ts).
// Only public events are exposed — the same data the "Public read face embeddings for
// public events" RLS policy already permits, just grouped per media for convenience.

const MAX_MEDIA_IDS = 400;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const eventHash: string | null = body?.eventHash ?? null;
    const rawIds: unknown = body?.mediaIds;

    if (!eventHash || !Array.isArray(rawIds)) {
      return NextResponse.json({ error: 'Missing eventHash or mediaIds' }, { status: 400 });
    }

    // Sanitize + cap the id list to bound the payload.
    const mediaIds = Array.from(
      new Set(rawIds.filter((x): x is string => typeof x === 'string')),
    ).slice(0, MAX_MEDIA_IDS);

    if (mediaIds.length === 0) {
      return NextResponse.json({ embeddings: {} });
    }

    // Resolve event (must be public) — mirrors app/api/face/search/route.ts.
    const publicClient = getPublicClient();
    const { data: eventData } = await publicClient
      .from('events')
      .select('id, is_public')
      .eq('event_hash', eventHash)
      .eq('is_public', true)
      .single();

    if (!eventData) {
      return NextResponse.json({ error: 'Event not found or not public' }, { status: 404 });
    }

    const adminClient = createAdminClient();
    const { data: rows, error } = await adminClient
      .from('face_embeddings')
      .select('media_id, embedding')
      .eq('event_id', (eventData as { id: string }).id)
      .in('media_id', mediaIds);

    if (error) {
      console.error('candidate-embeddings query failed:', error.message);
      return NextResponse.json({ error: 'Failed to load embeddings' }, { status: 500 });
    }

    // pgvector comes back as a JSON-array string like "[0.1,0.2,...]"; parse to number[].
    const embeddings: Record<string, number[][]> = {};
    for (const row of rows || []) {
      const vec = parseVector((row as { embedding: unknown }).embedding);
      if (!vec) continue;
      const id = (row as { media_id: string }).media_id;
      (embeddings[id] ||= []).push(vec);
    }

    return NextResponse.json({ embeddings });
  } catch (err) {
    console.error('candidate-embeddings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseVector(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
