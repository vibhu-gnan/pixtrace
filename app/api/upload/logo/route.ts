import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2BucketName, R2ConfigError } from '@/lib/storage/r2-client';
import { nanoid } from 'nanoid';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/upload/logo
 *
 * Server-side event logo upload. Multipart fields: `file`, `eventId`.
 */
export async function POST(request: NextRequest) {
  try {
    const organizer = await getCurrentOrganizer();
    if (!organizer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('file');
    const eventId = formData.get('eventId');

    if (!(file instanceof File) || typeof eventId !== 'string' || !eventId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('organizer_id', organizer.id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const uniqueId = nanoid();
    const ext = file.name.includes('.')
      ? file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'png'
      : 'png';
    const key = `logos/${organizer.id}/${eventId}/${uniqueId}.${ext}`;

    const body = Buffer.from(await file.arrayBuffer());
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return NextResponse.json({ key });
  } catch (error) {
    console.error('Error uploading logo:', error);

    if (error instanceof R2ConfigError) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}
