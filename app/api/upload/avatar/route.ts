import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2BucketName, R2ConfigError } from '@/lib/storage/r2-client';
import { nanoid } from 'nanoid';
import { getCurrentOrganizer } from '@/lib/auth/session';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    const organizer = await getCurrentOrganizer();
    if (!organizer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { filename?: string; contentType?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { filename, contentType } = body;

    if (!filename || typeof filename !== 'string' || !contentType || typeof contentType !== 'string') {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      );
    }

    const uniqueId = nanoid();
    const ext = filename.includes('.')
      ? filename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'png'
      : 'png';
    const key = `avatars/${organizer.id}/${uniqueId}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      ContentType: contentType,
      ContentLength: MAX_SIZE,
    });

    const signedUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 900 });

    return NextResponse.json({ uploadUrl: signedUrl, key });
  } catch (error) {
    console.error('Error generating avatar presigned URL:', error);

    if (error instanceof R2ConfigError) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
