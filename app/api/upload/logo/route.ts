
import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from '@/lib/storage/r2-client';
import { nanoid } from 'nanoid';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

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

        // Strict MIME type allowlist — SVG is excluded to prevent stored XSS
        if (!ALLOWED_LOGO_TYPES.includes(contentType)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
                { status: 400 }
            );
        }

        // Verify event belongs to organizer
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
        const ext = filename.includes('.') ? filename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') : 'png';
        // Key structure: logos/{organizer_id}/{event_id}/{unique_id}.{ext}
        const key = `logos/${organizer.id}/${eventId}/${uniqueId}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
            ContentLength: MAX_LOGO_SIZE, // Enforce max size at S3 level
        });

        // Generate presigned URL valid for 15 minutes (not 1 hour)
        const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

        return NextResponse.json({
            uploadUrl: signedUrl,
            key,
        });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
}
