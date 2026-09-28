import sharp from 'sharp';

/**
 * Server-side watermarking.
 *
 * Why this exists at all: gallery photos are normally handed to the browser as
 * presigned R2 URLs, so the bytes never pass through us. A CSS overlay on top
 * of one of those is decoration — right-click, open image, clean file. For a
 * gallery handed over before the client has paid, the mark has to be in the
 * pixels, which means the bytes have to come through a route we control.
 *
 * So when an event has the watermark on, actions/gallery.ts stops emitting
 * presigned URLs and points at /api/photo/[mediaId] instead. There is then no
 * unmarked URL to find.
 */

/** Tiled diagonally rather than a corner mark, which is one crop from gone. */
const ANGLE_DEG = -30;
/**
 * Low enough to review a photo through, high enough to deter using it.
 *
 * The dark stroke matters more than it looks: with a white fill alone the mark
 * vanished on bright backgrounds, which event photography is full of. The
 * outline is what carries it there, while the fill carries it on dark frames.
 * Verified by compositing over light, mid and dark panels.
 */
const FILL_OPACITY = 0.2;
const STROKE_OPACITY = 0.26;
const STROKE_WIDTH_RATIO = 0.07;

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!),
  );
}

/**
 * A tile of rotated text, repeated across the image with SVG <pattern>.
 *
 * Sizes are derived from the image's smaller edge so a 400px thumbnail and a
 * 6000px original carry a proportionally identical mark — a fixed point size
 * would be a billboard on one and illegible on the other.
 */
function watermarkSvg(width: number, height: number, text: string): Buffer {
  const base = Math.min(width, height);
  const fontSize = Math.max(14, Math.round(base * 0.045));
  const safe = escapeXml(text);

  // Tile big enough that the rotated text never clips against its own edges.
  const tileW = Math.round(fontSize * (safe.length * 0.72 + 6));
  const tileH = Math.round(fontSize * 5.5);

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       <defs>
         <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse"
                  patternTransform="rotate(${ANGLE_DEG})">
           <text x="0" y="${Math.round(tileH / 2)}"
                 font-family="Helvetica, Arial, sans-serif"
                 font-size="${fontSize}" font-weight="600" letter-spacing="${fontSize * 0.08}"
                 fill="#ffffff" fill-opacity="${FILL_OPACITY}"
                 stroke="#000000" stroke-opacity="${STROKE_OPACITY}" stroke-width="${Math.max(1, fontSize * STROKE_WIDTH_RATIO)}"
                 paint-order="stroke">${safe}</text>
         </pattern>
       </defs>
       <rect width="${width}" height="${height}" fill="url(#wm)"/>
     </svg>`,
  );
}

export interface WatermarkResult {
  buffer: Buffer;
  contentType: string;
}

/**
 * Composite `text` across `input`.
 *
 * `maxWidth` downscales first when given — used for gallery views, where
 * serving print-resolution pixels to an unpaid client would defeat the point
 * and cost a great deal of CPU for no benefit.
 *
 * Throws only if the input is not a decodable image; callers treat that as a
 * 404 rather than letting a broken file take down a gallery.
 */
export async function applyWatermark(
  input: Buffer,
  text: string,
  opts: { maxWidth?: number; quality?: number } = {},
): Promise<WatermarkResult> {
  const label = text.trim().slice(0, 60) || 'PIXTRACE';

  let pipeline = sharp(input, { failOn: 'none' }).rotate(); // honour EXIF orientation
  const meta = await pipeline.metadata();

  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  if (!width || !height) throw new Error('watermark: undecodable image');

  if (opts.maxWidth && width > opts.maxWidth) {
    const scale = opts.maxWidth / width;
    width = opts.maxWidth;
    height = Math.round(height * scale);
    pipeline = pipeline.resize(width, height);
  }

  const buffer = await pipeline
    .composite([{ input: watermarkSvg(width, height, label), blend: 'over' }])
    .webp({ quality: opts.quality ?? 82 })
    .toBuffer();

  return { buffer, contentType: 'image/webp' };
}

/** The studio name to burn in, in the order a photographer would expect. */
export function resolveWatermarkText(
  override: string | null | undefined,
  organizer: { credit_display_name?: string | null; business_name?: string | null; name?: string | null } | null,
): string {
  return (
    override?.trim() ||
    organizer?.credit_display_name?.trim() ||
    organizer?.business_name?.trim() ||
    organizer?.name?.trim() ||
    'PIXTRACE'
  );
}
