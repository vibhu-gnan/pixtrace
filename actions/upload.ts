'use server';

import { getCurrentOrganizer } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, getR2PublicUrl } from '@/lib/storage/r2-client';
import { nanoid } from 'nanoid';

export async function uploadHeroImage(eventId: string, formData: FormData) {
    const organizer = await getCurrentOrganizer();
    if (!organizer) return { error: 'Unauthorized' };

    const file = formData.get('file') as File;
    if (!file) return { error: 'No file provided' };

    // Validate file type
    if (!file.type.startsWith('image/')) {
        return { error: 'Invalid file type. Please upload an image.' };
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        return { error: 'File too large. Maximum size is 10MB.' };
    }

    // Check event ownership
    const supabase = createAdminClient();
    const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .eq('organizer_id', organizer.id)
        .single();

    if (!event) return { error: 'Event not found or unauthorized' };

    try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split('.').pop();
        const filename = `${nanoid()}.${ext}`;
        const key = `events/${eventId}/cover/${filename}`;

        await r2Client.send(
            new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: file.type,
            })
        );

        return {
            success: true,
            r2Key: key,
            url: getR2PublicUrl(key),
        };
    } catch (error) {
        console.error('Error uploading hero image:', error);
        return { error: 'Failed to upload image' };
    }
}
