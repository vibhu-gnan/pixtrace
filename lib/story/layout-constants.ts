/**
 * Geometry shared between the story-card canvas renderer and the template
 * picker's CSS previews.
 *
 * It lives in its own module for two reasons. First, `share-sheet.tsx` loads
 * the 504-line generator lazily (`await import(...)`) to keep it out of the
 * initial bundle — importing constants from there would undo that. Second, the
 * `TemplatePreview` mocks in the share sheet are hand-maintained copies of the
 * canvas layout; every previous layout change had to be mirrored by hand and
 * silently desynced when it wasn't. Both sides deriving their offsets from
 * these numbers makes that drift structurally impossible rather than a matter
 * of discipline.
 */

/** Instagram story canvas: 1080x1920, 9:16. */
export const W = 1080;
export const H = 1920;
export const PADDING = 40;

/**
 * Instagram overlays its own chrome on a shared story: the account row and
 * close button along the top, the reply bar and swipe affordance along the
 * bottom, and sticker/text overlays creep in from the sides.
 *
 * These are heuristics matching the commonly cited ~1080x1420 safe box, NOT a
 * published Instagram specification, and the chrome moves between app versions.
 * Validate by posting a real card from a device rather than trusting them.
 *
 * Anything a viewer must actually read — the event name, the photographer's
 * handle — belongs inside these bounds. Photography can bleed past them.
 */
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = 250;
export const SAFE_SIDE = 64;

/** Topmost y a readable element may occupy. */
export const SAFE_TOP_Y = SAFE_TOP;
/** Bottommost y a readable element may occupy. */
export const SAFE_BOTTOM_Y = H - SAFE_BOTTOM;
/** Usable width for readable content. */
export const SAFE_WIDTH = W - SAFE_SIDE * 2;

/** Percentage helpers, so the CSS previews can position from the same numbers. */
export const SAFE_TOP_PCT = (SAFE_TOP / H) * 100;
export const SAFE_BOTTOM_PCT = (SAFE_BOTTOM / H) * 100;
