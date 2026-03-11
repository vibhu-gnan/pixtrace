import { NextRequest, NextResponse } from 'next/server';
import { getR2Object, R2ConfigError, R2AccessError } from '@/lib/storage/r2-client';
import { verifyDownloadToken } from '@/lib/storage/download-token';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const filename = searchParams.get('filename') || 'download';

    if (!token) {
        return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
    }

    // Verify HMAC-signed token and extract r2Key
    const r2Key = verifyDownloadToken(token);
    if (!r2Key) {
        return NextResponse.json({ error: 'Invalid or expired download link' }, { status: 403 });
    }

    // Defense-in-depth: path traversal prevention — only allow safe R2 key characters
    if (r2Key.includes('..') || r2Key.startsWith('/') || /[^\w/._-]/.test(r2Key)) {
        return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    try {
        const { body, contentType } = await getR2Object(r2Key);

        // Reject files over 50MB
        if (body.byteLength > 50 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }

        // Sanitize filename
        const safeName = filename
            .replace(/[/\\]/g, '_')
            .replace(/\.\./g, '_')
            .slice(0, 255);

        return new NextResponse(Buffer.from(body), {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}"`,
                'Content-Length': body.byteLength.toString(),
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (err) {
        // ── Classified error responses ──
        if (err instanceof R2ConfigError) {
            console.error('[download] R2 not configured:', err.message);
            return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
        }

        if (err instanceof R2AccessError) {
            if (err.statusCode === 403) {
                console.error('[download] R2 access denied:', err.message);
                return NextResponse.json({ error: 'Storage access denied' }, { status: 502 });
            }
            if (err.statusCode === 404) {
                return NextResponse.json({ error: 'File not found' }, { status: 404 });
            }
            console.error('[download] R2 service error:', err.message);
            return NextResponse.json({ error: 'Storage temporarily unavailable' }, { status: 502 });
        }

        console.error('[download] Unexpected error:', err);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
