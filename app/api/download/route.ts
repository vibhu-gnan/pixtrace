import { NextRequest, NextResponse } from 'next/server';

// Allowed hostnames for download proxy — prevents open proxy / SSRF abuse
const ALLOWED_HOSTS = [
    'pub-cc4d5b144c5490713c006e00c5daf1a0.r2.dev', // Old/Backup
    'pub-326a39b9ee76449da28abc06e2fe351a.r2.dev', // Current R2 public bucket (from .env.local)
];

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const filename = searchParams.get('filename') || 'download';

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const parsedUrl = new URL(url);

        // Only allow HTTPS
        if (parsedUrl.protocol !== 'https:') {
            return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
        }

        // Restrict to allowed R2 hosts only
        if (!ALLOWED_HOSTS.some(host => parsedUrl.hostname === host)) {
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
        }

        // Fetch with timeout to prevent hanging connections
        const response = await fetch(url, {
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
        }

        // Reject files over 50MB
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Sanitize filename
        const safeName = filename
            .replace(/[/\\]/g, '_')
            .replace(/\.\./g, '_')
            .slice(0, 255);

        return new NextResponse(response.body, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}"`,
                ...(contentLength ? { 'Content-Length': contentLength } : {}),
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Download proxy error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
