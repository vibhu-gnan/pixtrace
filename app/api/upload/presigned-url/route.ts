import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { generatePresignedUrl } from '@/lib/storage/presigned-urls';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizerPlanLimits, canUpload } from '@/lib/plans/limits';

interface VariantRequest {
  suffix: string;
  contentType: string;
}

const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
];

const ALLOWED_VARIANT_TYPES = ['image/webp', 'image/jpeg', 'image/png'];
const ALLOWED_VARIANT_SUFFIXES = ['_thumb.webp', '_preview.webp'];
const MAX_VARIANTS = 3;

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

  const { eventId, albumId, filename, contentType, fileSize, variants } = body as {
    eventId: string;
    albumId: string;
    filename: string;
    contentType: string;
    fileSize: number;
    variants?: VariantRequest[];
  };

  if (!eventId || !albumId || !filename || !contentType || !fileSize) {
    return NextResponse.json(
      { error: 'Missing required fields: eventId, albumId, filename, contentType, fileSize' },
      { status: 400 }
    );
  }

  // Validate fileSize is a positive number
  if (typeof fileSize !== 'number' || fileSize <= 0 || !Number.isFinite(fileSize)) {
    return NextResponse.json({ error: 'Invalid fileSize' }, { status: 400 });
  }

  // Validate content type against allowlist
  if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `File type not allowed. Supported: ${ALLOWED_UPLOAD_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate variants
  if (variants) {
    if (variants.length > MAX_VARIANTS) {
      return NextResponse.json({ error: `Max ${MAX_VARIANTS} variants allowed` }, { status: 400 });
    }
    for (const v of variants) {
      if (!ALLOWED_VARIANT_TYPES.includes(v.contentType)) {
        return NextResponse.json({ error: `Invalid variant type: ${v.contentType}` }, { status: 400 });
      }
      if (!ALLOWED_VARIANT_SUFFIXES.includes(v.suffix)) {
        return NextResponse.json({ error: `Invalid variant suffix: ${v.suffix}` }, { status: 400 });
      }
    }
  }

  // Validate R2 env before calling SDK (avoids crash when env missing)
  const hasR2Env = !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
  if (!hasR2Env) {
    return NextResponse.json(
      { error: 'Storage not configured' },
      { status: 503 }
    );
  }

  // Check storage limits (fileSize is now required)
  const limits = await getOrganizerPlanLimits(organizer.id);
  const uploadCheck = canUpload(limits, fileSize);
  if (!uploadCheck.allowed) {
    return NextResponse.json({ error: uploadCheck.reason }, { status: 403 });
  }

  // Verify event belongs to organizer
  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', eventId)
    .eq('organizer_id', organizer.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Verify album belongs to this event
  const { data: album } = await supabase
    .from('albums')
    .select('id')
    .eq('id', albumId)
    .eq('event_id', eventId)
    .single();

  if (!album) {
    return NextResponse.json({ error: 'Album not found for this event' }, { status: 404 });
  }

  // Generate R2 key path
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `organizers/${organizer.id}/events/${eventId}/${albumId}/${timestamp}-${safeFilename}`;

  try {
    // Generate presigned URL for the original file
    const result = await generatePresignedUrl({
      key: r2Key,
      contentType,
    });

    const response: {
      url: string;
      r2Key: string;
      expiresAt: string;
      variants?: { suffix: string; url: string; r2Key: string }[];
    } = {
      url: result.url,
      r2Key,
      expiresAt: result.expiresAt.toISOString(),
    };

    // Generate presigned URLs for variants if requested
    if (variants && variants.length > 0) {
      const variantResults = await Promise.all(
        variants.map(async (v) => {
          const variantKey = `${r2Key}${v.suffix}`;
          const variantResult = await generatePresignedUrl({
            key: variantKey,
            contentType: v.contentType,
          });
          return {
            suffix: v.suffix,
            url: variantResult.url,
            r2Key: variantKey,
          };
        })
      );
      response.variants = variantResults;
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error('Failed to generate presigned URL:', e);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 503 }
    );
  }
}
