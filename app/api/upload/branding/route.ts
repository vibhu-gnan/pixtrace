import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2BucketName, R2ConfigError } from '@/lib/storage/r2-client';
import { nanoid } from 'nanoid';
import { getCurrentOrganizer } from '@/lib/auth/session';

/**
 * POST /api/upload/branding
 *
 * Server-side upload for the photographer-credit logo. Multipart `file` only —
 * no browser→R2 presigned PUT (avoids CORS / checksum failures on settings).
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

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
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Logo must be under 2MB' }, { status: 400 });
    }

    const uniqueId = nanoid();
    const ext = file.name.includes('.')
      ? file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'png'
      : 'png';
    // Must match sanitizeBrandingKey() and the organizers.credit_logo_url CHECK.
    const key = `branding/${organizer.id}/${uniqueId}.${ext}`;

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
    console.error('Error uploading branding logo:', error);

    if (error instanceof R2ConfigError) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}
