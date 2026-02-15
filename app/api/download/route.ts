import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const filename = searchParams.get('filename') || 'download';

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        // Basic validation to prevent open proxy abuse (optional but recommended)
        // Here we check if the protocol is https
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:') {
            return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
        }

        // Fetch the file from the external URL
        const response = await fetch(url);

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
        }

        // Get the content type from the response headers or fallback
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Stream the response back to the client
        // We can pass the body directly to the new Response
        // Setting Content-Disposition forces the browser to download it
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            },
        });
    } catch (error) {
        console.error('Download proxy error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
