import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicClient } from '@/lib/supabase/public';

// Serves the stored face embeddings for a set of matched media so the client can
// re-rank the face-search review queue locally (see lib/face/client-rerank.ts).
// Only public events are exposed — the same data the "Public read face embeddings for
// public events" RLS policy already permits, just grouped per media for convenience.

const MAX_MEDIA_IDS = 400;

// Grow the detector's tight box so the crop reads as a person rather than a pair of eyes.
const FACE_CROP_PAD = 0.45;

/**
 * A face box as a padded square in 0..1 fractions of the image.
 *
 * Fractions survive the preview/original swap the gallery does, and squaring here (in
 * pixel space, where the aspect ratio is known) means the UI can crop with plain CSS
 * without stretching the face.
 */
function normalizeFaceBox(
  box: [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] | null {
  const [x1, y1, x2, y2] = box;
  if (!width || !height || x2 <= x1 || y2 <= y1) return null;

  const side = Math.min(
    Math.max(x2 - x1, y2 - y1) * (1 + FACE_CROP_PAD),
    Math.min(width, height),
  );
  const half = side / 2;
  const cx = Math.min(Math.max((x1 + x2) / 2, half), width - half);
  const cy = Math.min(Math.max((y1 + y2) / 2, half), height - half);

  return [(cx - half) / width, (cy - half) / height, side / width, side / height];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const eventHash: string | null = body?.eventHash ?? null;
    const rawIds: unknown = body?.mediaIds;
    // Crops need only the boxes, which are ~0.1MB and land in ~200ms, while the
    // embeddings run to tens of MB. Fetching them together made the review UI wait
    // seconds for data it did not need yet.
    const boxesOnly: boolean = body?.boxesOnly === true;

    if (!eventHash || !Array.isArray(rawIds)) {
      return NextResponse.json({ error: 'Missing eventHash or mediaIds' }, { status: 400 });
    }

    // Sanitize + cap the id list to bound the payload.
    const mediaIds = Array.from(
      new Set(rawIds.filter((x): x is string => typeof x === 'string')),
    ).slice(0, MAX_MEDIA_IDS);

    if (mediaIds.length === 0) {
      return NextResponse.json({ embeddings: {}, boxes: {} });
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
    // Group shots carry 20+ faces each, so a few hundred matches run to thousands of
    // rows — well past PostgREST's 1000-row default. Truncation here is silent and the
    // re-ranker reads a missing embedding as "leave it for the human", so an unpaged
    // query quietly strands most of the review queue.
    const PAGE = 1000;
    const columns = boxesOnly
      ? 'media_id, bbox_x1, bbox_y1, bbox_x2, bbox_y2'
      : 'media_id, embedding, bbox_x1, bbox_y1, bbox_x2, bbox_y2';
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await adminClient
        .from('face_embeddings')
        .select(columns)
        .eq('event_id', (eventData as { id: string }).id)
        .in('media_id', mediaIds)
        .range(from, from + PAGE - 1);

      if (error) {
        console.error('candidate-embeddings query failed:', error.message);
        return NextResponse.json({ error: 'Failed to load embeddings' }, { status: 500 });
      }

      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }

    // Face boxes are stored in the original image's pixels, so the dimensions are needed
    // to turn them into fractions the UI can crop with at any variant size.
    const { data: mediaRows } = await adminClient
      .from('media')
      .select('id, width, height')
      .in('id', mediaIds);

    const dimensions = new Map<string, { width: number; height: number }>();
    for (const m of mediaRows || []) {
      const row = m as { id: string; width: number | null; height: number | null };
      dimensions.set(row.id, { width: row.width ?? 0, height: row.height ?? 0 });
    }

    // pgvector comes back as a JSON-array string like "[0.1,0.2,...]"; parse to number[].
    // `boxes` stays index-aligned with `embeddings` so the review UI can crop to the exact
    // face a decision is about, instead of asking about a whole crowd photo. An entry is
    // null when the box can't be placed, and the UI falls back to the full photo.
    const embeddings: Record<string, number[][]> = {};
    const boxes: Record<string, (number[] | null)[]> = {};
    for (const row of rows || []) {
      const vec = boxesOnly ? null : parseVector((row as { embedding: unknown }).embedding);
      if (!boxesOnly && !vec) continue;
      const r = row as {
        media_id: string;
        bbox_x1: number | null;
        bbox_y1: number | null;
        bbox_x2: number | null;
        bbox_y2: number | null;
      };
      const dim = dimensions.get(r.media_id);
      const box = dim
        ? normalizeFaceBox(
            [r.bbox_x1 ?? 0, r.bbox_y1 ?? 0, r.bbox_x2 ?? 0, r.bbox_y2 ?? 0],
            dim.width,
            dim.height,
          )
        : null;

      if (vec) (embeddings[r.media_id] ||= []).push(vec);
      (boxes[r.media_id] ||= []).push(box);
    }

    return NextResponse.json(boxesOnly ? { boxes } : { embeddings, boxes });
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
