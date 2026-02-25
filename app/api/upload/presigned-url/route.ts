import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { generatePresignedUrl } from '@/lib/storage/presigned-urls';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrganizerPlanLimits, canUpload } from '@/lib/plans/limits';

interface VariantRequest {
  suffix: string;
  contentType: string;
}

export async function POST(request: NextRequest) {
  const organizer = await getCurrentOrganizer();
  if (!organizer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { eventId, albumId, filename, contentType, fileSize, variants } = body as {
    eventId: string;
    albumId: string;
    filename: string;
    contentType: string;
    fileSize: number;
    variants?: VariantRequest[];
  };

  if (!eventId || !albumId || !filename || !contentType) {
    return NextResponse.json(
      { error: 'Missing required fields: eventId, albumId, filename, contentType' },
      { status: 400 }
    );
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

  // Check storage limits
  if (fileSize) {
    const limits = await getOrganizerPlanLimits(organizer.id);
    const uploadCheck = canUpload(limits, fileSize);
    if (!uploadCheck.allowed) {
      return NextResponse.json({ error: uploadCheck.reason }, { status: 403 });
    }
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

    const response: any = {
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
