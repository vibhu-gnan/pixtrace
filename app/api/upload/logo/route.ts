
import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from '@/lib/storage/r2-client';
import { nanoid } from 'nanoid';
import { getCurrentOrganizer } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
    try {
        const organizer = await getCurrentOrganizer();
        if (!organizer) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { filename, contentType, eventId } = await request.json();

        if (!filename || !contentType || !eventId) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Validate file type (images only)
        if (!contentType.startsWith('image/')) {
            return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
        }

        const uniqueId = nanoid();
        const ext = filename.split('.').pop();
        // Key structure: logos/{organizer_id}/{event_id}/{unique_id}.{ext}
        const key = `logos/${organizer.id}/${eventId}/${uniqueId}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        // Generate presigned URL valid for 1 hour
        const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

        const publicUrl = process.env.R2_PUBLIC_URL
            ? `${process.env.R2_PUBLIC_URL}/${key}`
            : `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;

        return NextResponse.json({
            uploadUrl: signedUrl,
            key,
            url: publicUrl
        });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
}
