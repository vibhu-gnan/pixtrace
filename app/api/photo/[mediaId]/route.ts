import { NextRequest, NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/supabase/public';
import { createAdminClient } from '@/lib/supabase/admin';
import { getR2Object, getSignedR2Url, R2ConfigError } from '@/lib/storage/r2-client';
import { applyWatermark, resolveWatermarkText } from '@/lib/images/watermark';

/**
 * GET /api/photo/[mediaId]?v=<version>
 *
 * Serves a watermarked photo for a public gallery.
 *
 * This route only exists because of where the bytes normally come from. A
 * gallery hands the browser presigned R2 URLs, so an overlay drawn in CSS sits
 * on top of an image the visitor can open cleanly in one right-click. When an
 * event has the watermark on, actions/gallery.ts stops emitting those URLs and
 * emits this route instead — there is then no unmarked URL in the page to find.
 *
 * Visibility is enforced by reading `media` through the ANON client: the RLS
 * policy already restricts it to public events and excludes takedown-hidden
 * and purged photos, so this inherits that rather than reimplementing it. The
 * admin client is used only afterwards, for the event's watermark settings and
 * the studio name, neither of which anon may read.
 *
 * Responses are immutable and long-cached; `v` changes when the event does,
 * which is what evicts them.
 */

export const runtime = 'nodejs'; // sharp needs the Node runtime, not edge

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Gallery views never need print resolution — and an unpaid client least of all. */
const GALLERY_MAX_WIDTH = 1400;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const { mediaId } = await params;
    if (!UUID_RE.test(mediaId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Anon client on purpose — RLS is the visibility check.
    const pub = getPublicClient();
    const { data: media } = await pub
      .from('media')
      .select('id, event_id, r2_key, preview_r2_key, media_type')
      .eq('id', mediaId)
      .maybeSingle();

    if (!media) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = media as unknown as {
      event_id: string; r2_key: string; preview_r2_key: string | null; media_type: string;
    };

    const admin = createAdminClient();
    const { data: event } = await admin
      .from('events')
      .select('watermark_enabled, watermark_text, organizers(credit_display_name, business_name, name)')
      .eq('id', row.event_id)
      .maybeSingle();

    const ev = event as unknown as {
      watermark_enabled: boolean | null;
      watermark_text: string | null;
      organizers: { credit_display_name: string | null; business_name: string | null; name: string | null } | null;
    } | null;

    // Watermark off: nothing to composite. Redirect to the presigned URL rather
    // than 404, so a link cached from while it was on still resolves.
    if (!ev?.watermark_enabled) {
      const key = row.preview_r2_key || row.r2_key;
      try {
        return NextResponse.redirect(await getSignedR2Url(key), 302);
      } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const sourceKey = row.preview_r2_key || row.r2_key;
    const { body } = await getR2Object(sourceKey);

    const text = resolveWatermarkText(ev.watermark_text, ev.organizers);
    const { buffer, contentType } = await applyWatermark(Buffer.from(body), text, {
      maxWidth: GALLERY_MAX_WIDTH,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        // Safe to cache hard: the URL carries a version that changes with the
        // event, so flipping the toggle produces different URLs entirely.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    if (err instanceof R2ConfigError) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }
    console.error('[photo] watermark serve failed:', err);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
