// Geometry is shared with the CSS template previews in share-sheet.tsx — see
// lib/story/layout-constants.ts for why that matters.
import { W, H, PADDING, SAFE_BOTTOM_Y, SAFE_TOP_Y, SAFE_SIDE, SAFE_WIDTH } from './layout-constants';

export type StoryTemplate = 'full-bleed' | 'polaroid' | 'immersive' | 'glass-frame';

export interface StoryCardOptions {
  photoUrl: string;
  photoR2Key?: string;
  eventName: string;
  eventSubtitle?: string;
  logoUrl?: string;
  template: StoryTemplate;
  /** Photographer credit, e.g. '@aaravstudio'. Falls back to creditName. */
  creditHandle?: string;
  /** Studio name, used when there is no Instagram handle. */
  creditName?: string;
  /** False suppresses the PIXTRACE mark (white_label plans). Defaults true. */
  showPoweredBy?: boolean;
}

export async function generateStoryCard(options: StoryCardOptions, signal?: AbortSignal): Promise<Blob> {
  // Resolved once and threaded through: measureText must be called with the
  // same font the glyphs are eventually painted in, or the greedy wrap in
  // drawWrappedText breaks lines against the wrong metrics.
  const family = interFamily();

  const [photo, logo] = await Promise.all([
    loadImageFromUrl(options.photoUrl, options.photoR2Key, signal),
    options.logoUrl ? loadImageFromUrl(options.logoUrl, undefined, signal).catch(() => null) : Promise.resolve(null),
    ensureFontsLoaded(family),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  try {
    switch (options.template) {
      case 'full-bleed':
        renderFullBleed(ctx, photo, logo, options, family);
        break;
      case 'polaroid':
        renderPolaroid(ctx, photo, logo, options, family);
        break;
      case 'immersive':
        renderImmersive(ctx, photo, logo, options, family);
        break;
      case 'glass-frame':
        renderGlassFrame(ctx, photo, logo, options, family);
        break;
    }

    return await canvasToPNG(canvas);
  } finally {
    // Release the ~8MB pixel buffer immediately
    canvas.width = 0;
    canvas.height = 0;
  }
}


// ─── Fonts ───────────────────────────────────────────────────

/**
 * The real Inter family name.
 *
 * Every ctx.font here used to say the literal "Inter", which is not a
 * registered family: next/font/google emits a hashed name (__Inter_xxxxxx) and
 * exposes it as the CSS variable --font-inter, set on <html> in app/layout.tsx.
 * Canvas silently fell back to system-ui, so every card shipped in the wrong
 * typeface AND measureText returned the wrong widths, which means the greedy
 * wrap in drawWrappedText was breaking lines in the wrong places too.
 *
 * Read at call time, never hardcoded — the hash changes whenever the font
 * config does.
 */
function interFamily(): string {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-inter')
      .trim();
    return v ? `${v}, system-ui, sans-serif` : 'system-ui, sans-serif';
  } catch {
    return 'system-ui, sans-serif';
  }
}

/** Weights this module draws with. Must all exist in app/layout.tsx. */
const USED_WEIGHTS = [400, 700, 800] as const;

/**
 * Canvas draws with whatever faces are loaded at that instant, so the correct
 * family name alone is not enough on a cold page — the first card would still
 * be measured and painted in the fallback. Nothing else in the app touches
 * document.fonts, so this is the only place it gets awaited.
 */
async function ensureFontsLoaded(family: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all(
      USED_WEIGHTS.map((w) => document.fonts.load(`${w} 56px ${family}`).catch(() => {})),
    );
    await document.fonts.ready;
  } catch {
    // Never block card generation on font loading.
  }
}

/** Set ctx.font from the resolved family. */
function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string) {
  ctx.font = `${weight} ${size}px ${family}`;
}


// ─── Layout helpers ──────────────────────────────────────────

/**
 * Scale a logo to a target height, clamped so a wide mark cannot run off the
 * canvas. There was no clamp before: width came straight from the aspect ratio,
 * so a 2000x200 banner logo drew past 1080px and off both edges.
 */
function fitLogo(logo: HTMLImageElement, maxH: number, maxW: number): { w: number; h: number } {
  let h = maxH;
  let w = Math.round((logo.naturalWidth / logo.naturalHeight) * h);
  if (w > maxW) {
    w = maxW;
    h = Math.round(w * (logo.naturalHeight / logo.naturalWidth));
  }
  return { w, h };
}

/**
 * Truncate to fit a width, with an ellipsis. Binary search rather than the
 * obvious character-at-a-time loop: measureText is the expensive call here, so
 * a 30-character handle costs ~5 measurements instead of 30.
 *
 * Call this with the final ctx.font already set.
 */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const E = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + E).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + E;
}

/**
 * The photographer's mark: optional round logo plus @handle (or studio name)
 * in a pill. Generalises the hardcoded "PIXTRACE" that used to sit in
 * glass-frame — the same idea, but crediting whoever actually took the photo.
 *
 * Returns the height consumed, so callers can stack text above it.
 */
function drawCreditLockup(
  ctx: CanvasRenderingContext2D,
  opts: StoryCardOptions,
  family: string,
  cfg: { centerX: number; baselineY: number; tone: 'light' | 'dark'; align?: 'center' | 'right' },
): number {
  const label = opts.creditHandle || opts.creditName;
  if (!label) return 0;

  const light = cfg.tone === 'light';
  const fontSize = 30;
  setFont(ctx, 600, fontSize, family);

  const maxTextW = SAFE_WIDTH - 120;
  const text = ellipsize(ctx, label, maxTextW);
  const textW = ctx.measureText(text).width;

  const pillH = 64;
  const padX = 26;
  const pillW = Math.round(textW + padX * 2);
  const pillX = cfg.align === 'right' ? cfg.centerX - pillW : cfg.centerX - pillW / 2;
  const pillY = cfg.baselineY - pillH;

  ctx.fillStyle = light ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.06)';
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = light ? 'rgba(255,255,255,0.92)' : '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pillX + pillW / 2, pillY + pillH / 2 + 1);
  ctx.textBaseline = 'alphabetic';

  return pillH;
}

/**
 * Our own mark, deliberately quieter than the photographer's: 18px at 0.4
 * alpha against their 30px at 0.92. Suppressed entirely under white_label.
 */
function drawPoweredBy(
  ctx: CanvasRenderingContext2D,
  opts: StoryCardOptions,
  family: string,
  x: number,
  y: number,
  align: CanvasTextAlign = 'center',
) {
  if (opts.showPoweredBy === false) return;
  setFont(ctx, 700, 18, family);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = align;
  ctx.fillText('PIXTRACE', x, y);
}

// ─── Template Renderers ──────────────────────────────────────

function renderFullBleed(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  logo: HTMLImageElement | null,
  opts: StoryCardOptions,
  family: string,
) {
  // Photo fills entire canvas
  drawCoverFit(ctx, photo, 0, 0, W, H);

  // Dark gradient at bottom
  const grad = ctx.createLinearGradient(0, H * 0.45, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Bottom stack starts above Instagram's reply bar, not at the canvas edge —
  // text at H-100 sat underneath it and was simply never read.
  let bottomY = SAFE_BOTTOM_Y - 20;

  // Photographer credit sits lowest: it is the thing this card exists to carry.
  const creditH = drawCreditLockup(ctx, opts, family, {
    centerX: W / 2, baselineY: bottomY, tone: 'light',
  });
  if (creditH) bottomY -= creditH + 24;

  // Logo pill above it if available
  if (logo) {
    const { w: logoW, h: logoH } = fitLogo(logo, 48, SAFE_WIDTH - 64);
    const pillW = logoW + 32;
    const pillH = logoH + 16;
    const pillX = (W - pillW) / 2;
    const pillY = bottomY - pillH;

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.drawImage(logo, pillX + 16, pillY + 8, logoW, logoH);
    bottomY = pillY - 24;
  }

  // Subtitle
  if (opts.eventSubtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    setFont(ctx, 400, 28, family);
    ctx.textAlign = 'center';
    ctx.fillText(opts.eventSubtitle, W / 2, bottomY);
    bottomY -= 16;
  }

  // Event name
  ctx.fillStyle = '#ffffff';
  setFont(ctx, 800, 56, family);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  drawWrappedText(ctx, opts.eventName.toUpperCase(), W / 2, bottomY, W - PADDING * 2, 66);
  ctx.shadowBlur = 0;
}

function renderPolaroid(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  logo: HTMLImageElement | null,
  opts: StoryCardOptions,
  family: string,
) {
  // Blurred photo background
  const dominantColor = extractDominantColor(photo);
  drawBlurredBackground(ctx, photo, dominantColor);

  // White polaroid card
  const cardW = 860;
  const cardX = (W - cardW) / 2;
  const photoSize = 820;
  const cardPadding = 20;
  const textAreaH = 110;
  const cardH = cardPadding + photoSize + textAreaH + cardPadding;
  const cardY = (H - cardH) / 2 - 40;

  // Card shadow
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Photo inside card
  const photoX = cardX + cardPadding;
  const photoY = cardY + cardPadding;
  ctx.save();
  roundRect(ctx, photoX, photoY, photoSize, photoSize, 10);
  ctx.clip();
  drawCoverFit(ctx, photo, photoX, photoY, photoSize, photoSize);
  ctx.restore();

  // Event name inside card
  ctx.fillStyle = '#111111';
  setFont(ctx, 800, 44, family);
  ctx.textAlign = 'center';
  const nameY = photoY + photoSize + 50;
  drawWrappedText(ctx, opts.eventName.toUpperCase(), W / 2, nameY, cardW - 60, 52);

  // Subtitle
  if (opts.eventSubtitle) {
    ctx.fillStyle = '#aaaaaa';
    setFont(ctx, 400, 24, family);
    ctx.fillText(opts.eventSubtitle, W / 2, nameY + 32);
  }

  // Credit INSIDE the white card, under the event name. On this template it
  // reads as a photographer's signature on a print, which is the least
  // ad-like placement of the four — and the most likely to survive a crop.
  if (opts.creditHandle || opts.creditName) {
    const label = opts.creditHandle || opts.creditName!;
    setFont(ctx, 600, 26, family);
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText(ellipsize(ctx, label, cardW - 80), W / 2, cardY + cardH - 26);
  }

  // Logo below the card, clamped and kept clear of Instagram's reply bar.
  if (logo) {
    const { w: logoW, h: logoH } = fitLogo(logo, 44, SAFE_WIDTH - 80);
    const y = Math.min(cardY + cardH + 30, SAFE_BOTTOM_Y - logoH - 40);
    ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
  }

  drawPoweredBy(ctx, opts, family, W / 2, SAFE_BOTTOM_Y - 8);
}

function renderImmersive(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  logo: HTMLImageElement | null,
  opts: StoryCardOptions,
  family: string,
) {
  // Photo fills entire canvas
  drawCoverFit(ctx, photo, 0, 0, W, H);

  // Gradient overlays
  const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.25);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, H * 0.25);

  const bottomGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.7, 'rgba(0,0,0,0.7)');
  bottomGrad.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // Logo pill. Was pinned at y=44, i.e. directly under Instagram's account row
  // and close button — moved into the bottom stack where it can be seen.
  if (logo) {
    const { w: logoW, h: logoH } = fitLogo(logo, 36, SAFE_WIDTH - 80);
    const pillW = logoW + 40;
    const pillH = logoH + 20;
    const pillX = (W - pillW) / 2;
    const pillY = SAFE_TOP_Y;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.drawImage(logo, pillX + 20, pillY + 10, logoW, logoH);
  }

  // Bottom stack, clear of the reply bar (was H-80, i.e. underneath it).
  let bottomY = SAFE_BOTTOM_Y - 20;

  drawPoweredBy(ctx, opts, family, W / 2, bottomY);
  bottomY -= 28;

  const creditH = drawCreditLockup(ctx, opts, family, {
    centerX: W / 2, baselineY: bottomY, tone: 'light',
  });
  if (creditH) bottomY -= creditH + 20;

  if (opts.eventSubtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    setFont(ctx, 400, 26, family);
    ctx.textAlign = 'center';
    ctx.fillText(opts.eventSubtitle, W / 2, bottomY);
    bottomY -= 18;
  }

  ctx.fillStyle = '#ffffff';
  setFont(ctx, 800, 58, family);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  drawWrappedText(ctx, opts.eventName.toUpperCase(), W / 2, bottomY, W - PADDING * 2, 68);
  ctx.shadowBlur = 0;
}

function renderGlassFrame(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  logo: HTMLImageElement | null,
  opts: StoryCardOptions,
  family: string,
) {
  // Soft-blurred photo background — detail stays visible (bokeh, shapes)
  // Use a higher scale than drawBlurredBackground (0.15 vs 0.05) so the
  // photo is recognizable, not a solid color.
  const bgTemp = document.createElement('canvas');
  const bgScale = 0.015; // 1.5% — doubled blur
  bgTemp.width = Math.round(W * bgScale);
  bgTemp.height = Math.round(H * bgScale);
  const bgCtx = bgTemp.getContext('2d')!;
  drawCoverFit(bgCtx, photo, 0, 0, bgTemp.width, bgTemp.height);
  // Multi-pass: draw scaled-down version onto itself for smoother blur
  bgCtx.drawImage(bgTemp, 0, 0, bgTemp.width, bgTemp.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bgTemp, 0, 0, W, H);

  // Darken overlay for contrast
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 0, W, H);

  // ─── Glass card — photo keeps natural aspect ratio ─────────
  const cardPad = 20;
  const cardRadius = 32;
  const photoRadius = 24;

  // 4:5 portrait frame, DERIVED from what is left after the safe areas and the
  // text below rather than hardcoded.
  //
  // The old geometry (960x1200 at cardY=140) does not survive safe areas: its
  // card bottom was 1380, the subtitle landed at 1496, the logo occupied
  // 1690-1824 and the mark sat at 1876 — all of which are under Instagram's
  // chrome. Fitting the same composition into 250..1670 means the frame has to
  // shrink, so it is computed here and will track any future change to the
  // safe-area constants.
  const textBlockH = 110;                       // event name + optional subtitle
  const lockupH = opts.creditHandle || opts.creditName ? 64 : 0;
  const gaps = 72 + (lockupH ? 24 : 0);
  const availableCardH = (SAFE_BOTTOM_Y - SAFE_TOP_Y) - textBlockH - lockupH - gaps;

  let photoH = availableCardH - cardPad * 2;
  let photoW = Math.round(photoH * 4 / 5);
  const maxPhotoW = Math.min(W - 120, SAFE_WIDTH);
  if (photoW > maxPhotoW) {
    photoW = maxPhotoW;
    photoH = Math.round(photoW * 5 / 4);
  }

  const cardW = photoW + cardPad * 2;
  const cardH = photoH + cardPad * 2;
  const cardX = (W - cardW) / 2;
  const cardY = SAFE_TOP_Y;

  // Glass card fill
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();

  // Glass card border — bright enough to see clearly
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2.5;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();

  // Top highlight shine on glass card
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.clip();
  const shineGrad = ctx.createLinearGradient(0, cardY, 0, cardY + 6);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad;
  ctx.fillRect(cardX, cardY, cardW, 6);
  ctx.restore();

  // Photo inside glass card
  const photoX = cardX + cardPad;
  const photoY = cardY + cardPad;
  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, photoRadius);
  ctx.clip();
  drawCoverFit(ctx, photo, photoX, photoY, photoW, photoH);
  ctx.restore();

  // ─── Text below card ──────────────────────────────────────
  let textY = cardY + cardH + 72;
  ctx.fillStyle = '#ffffff';
  setFont(ctx, 800, 52, family);
  ctx.textAlign = 'center';
  drawWrappedText(ctx, opts.eventName.toUpperCase(), W / 2, textY, W - PADDING * 2, 62);

  // Subtitle
  if (opts.eventSubtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    setFont(ctx, 400, 26, family);
    ctx.fillText(opts.eventSubtitle, W / 2, textY + 44);
  }

  // Photographer credit, right-aligned — this replaces the hardcoded PIXTRACE
  // mark that used to live here. Same idiom, crediting whoever took the photo.
  drawCreditLockup(ctx, opts, family, {
    centerX: W - SAFE_SIDE,
    baselineY: SAFE_BOTTOM_Y,
    tone: 'light',
    align: 'right',
  });

  // Our own mark, demoted and left-aligned so the two do not compete.
  drawPoweredBy(ctx, opts, family, SAFE_SIDE, SAFE_BOTTOM_Y - 22, 'left');
  ctx.textAlign = 'center';

  // Logo between the text block and the credit, clamped to the safe width.
  if (logo) {
    const { w: logoW, h: logoH } = fitLogo(logo, 96, SAFE_WIDTH - 120);
    const y = SAFE_BOTTOM_Y - lockupH - 16 - logoH;
    if (y > textY + 60) ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
  }
}

// ─── Shared Utilities ────────────────────────────────────────

async function loadImageFromUrl(url: string, r2Key?: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  // Proxy R2 images through our API to avoid CORS issues with canvas
  const fetchUrl = r2Key
    ? `/api/proxy-image?r2Key=${encodeURIComponent(r2Key)}`
    : url;

  const res = await fetch(fetchUrl, { signal });
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    // Clean up if aborted while decoding
    const onAbort = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new DOMException('Image load aborted', 'AbortError'));
    };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener('abort', onAbort, { once: true });

    const img = new Image();
    img.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode image: ${url}`));
    };
    img.src = objectUrl;
  });
}

function extractDominantColor(img: HTMLImageElement): { r: number; g: number; b: number } {
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  let r = 0, g = 0, b = 0;
  const count = size * size;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

function drawBlurredBackground(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  color: { r: number; g: number; b: number },
) {
  // Since Canvas API doesn't support blur filter on all browsers,
  // use a scaled-down draw + scale-up approach for blur effect
  const tempCanvas = document.createElement('canvas');
  const blurScale = 0.05; // very small = very blurry
  tempCanvas.width = Math.round(W * blurScale);
  tempCanvas.height = Math.round(H * blurScale);
  const tempCtx = tempCanvas.getContext('2d')!;

  // Draw photo scaled way down (creates natural pixelated blur)
  drawCoverFit(tempCtx, photo, 0, 0, tempCanvas.width, tempCanvas.height);

  // Draw it back at full size (pixelation = blur-like effect)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tempCanvas, 0, 0, W, H);

  // Darken and tint with dominant color
  ctx.fillStyle = `rgba(${Math.round(color.r * 0.3)}, ${Math.round(color.g * 0.3)}, ${Math.round(color.b * 0.3)}, 0.6)`;
  ctx.fillRect(0, 0, W, H);
}

function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = dw / dh;

  let sx: number, sy: number, sw: number, sh: number;

  if (imgRatio > targetRatio) {
    // Image is wider — crop sides
    sh = img.naturalHeight;
    sw = sh * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    // Image is taller — crop top/bottom
    sw = img.naturalWidth;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) {
  const MAX_LINES = 6; // Prevent excessive lines from extremely long text
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      if (lines.length >= MAX_LINES) break;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line && lines.length < MAX_LINES) lines.push(line);

  // Draw from bottom up so startY is the bottom of the text block
  const totalHeight = (lines.length - 1) * lineHeight;
  const topY = startY - totalHeight;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, topY + i * lineHeight);
  }
}

function canvasToPNG(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate PNG blob'));
      },
      'image/png',
    );
  });
}
