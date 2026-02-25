export type StoryTemplate = 'full-bleed' | 'polaroid' | 'immersive' | 'glass-frame';

export interface StoryCardOptions {
  photoUrl: string;
  eventName: string;
  eventSubtitle?: string;
  logoUrl?: string;
  template: StoryTemplate;
}

const W = 1080;
const H = 1920;
const PADDING = 40;

export async function generateStoryCard(options: StoryCardOptions): Promise<Blob> {
  const photo = await loadImageFromUrl(options.photoUrl);
  const logo = options.logoUrl ? await loadImageFromUrl(options.logoUrl).catch(() => null) : null;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  switch (options.template) {
    case 'full-bleed':
      renderFullBleed(ctx, photo, logo, options);
      break;
    case 'polaroid':
      renderPolaroid(ctx, photo, logo, options);
      break;
    case 'immersive':
      renderImmersive(ctx, photo, logo, options);
      break;
    case 'glass-frame':
      renderGlassFrame(ctx, photo, logo, options);
      break;
  }

  return canvasToPNG(canvas);
}

// ─── Template Renderers ──────────────────────────────────────

function renderFullBleed(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  logo: HTMLImageElement | null,
  opts: StoryCardOptions,
) {
  // Photo fills entire canvas
  drawCoverFit(ctx, photo, 0, 0, W, H);

  // Dark gradient at bottom
  const grad = ctx.createLinearGradient(0, H * 0.45, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Event name
  let bottomY = H - 100;

  // Logo pill at bottom if available
  if (logo) {
    const logoH = 48;
    const logoW = Math.round((logo.naturalWidth / logo.naturalHeight) * logoH);
    const pillW = logoW + 32;
    const pillH = logoH + 16;
    const pillX = (W - pillW) / 2;
    const pillY = bottomY - 10;

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.drawImage(logo, pillX + 16, pillY + 8, logoW, logoH);
    bottomY = pillY - 24;
  }

  // Subtitle
  if (opts.eventSubtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 28px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.eventSubtitle, W / 2, bottomY);
    bottomY -= 16;
  }

  // Event name
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 56px Inter, system-ui, sans-serif';
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
  ctx.font = '800 44px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const nameY = photoY + photoSize + 50;
  drawWrappedText(ctx, opts.eventName.toUpperCase(), W / 2, nameY, cardW - 60, 52);

  // Subtitle
  if (opts.eventSubtitle) {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '400 24px Inter, system-ui, sans-serif';
    ctx.fillText(opts.eventSubtitle, W / 2, nameY + 32);
  }

  // Logo below card
  if (logo) {
    const logoH = 44;
    const logoW = Math.round((logo.naturalWidth / logo.naturalHeight) * logoH);
    ctx.drawImage(logo, (W - logoW) / 2, cardY + cardH + 30, logoW, logoH);
  }
}

function renderImmersive(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  logo: HTMLImageElement | null,
  opts: StoryCardOptions,
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

  // Logo pill at top
  if (logo) {
    const logoH = 36;
    const logoW = Math.round((logo.naturalWidth / logo.naturalHeight) * logoH);
    const pillW = logoW + 40;
    const pillH = logoH + 20;
    const pillX = (W - pillW) / 2;
    const pillY = 44;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    ctx.drawImage(logo, pillX + 20, pillY + 10, logoW, logoH);
  }

  // Event name at bottom
  let bottomY = H - 80;

  if (opts.eventSubtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '400 26px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.eventSubtitle, W / 2, bottomY);
    bottomY -= 18;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 58px Inter, system-ui, sans-serif';
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
) {
  // Soft-blurred photo background — detail stays visible (bokeh, shapes)
  // Use a higher scale than drawBlurredBackground (0.15 vs 0.05) so the
  // photo is recognizable, not a solid color.
  const bgTemp = document.createElement('canvas');
  const bgScale = 0.03; // 3% — maximum blur, full bokeh background
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

  // Force 4:5 portrait frame regardless of source image orientation
  const maxPhotoW = W - 120;   // 60px margins each side
  const photoW = maxPhotoW;
  const photoH = Math.round(photoW * 5 / 4); // 4:5 → 960×1200

  const cardW = photoW + cardPad * 2;
  const cardH = photoH + cardPad * 2;
  const cardX = (W - cardW) / 2;
  const cardY = 140;

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
  ctx.font = '800 52px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  drawWrappedText(ctx, opts.eventName.toUpperCase(), W / 2, textY, W - PADDING * 2, 62);

  // Subtitle
  if (opts.eventSubtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 26px Inter, system-ui, sans-serif';
    ctx.fillText(opts.eventSubtitle, W / 2, textY + 44);
  }

  // PIXTRACE watermark — bottom right
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('PIXTRACE', W - 44, H - 44);
  ctx.textAlign = 'center';

  // Logo at bottom center
  if (logo) {
    const logoH = 192;
    const logoW = Math.round((logo.naturalWidth / logo.naturalHeight) * logoH);
    ctx.drawImage(logo, (W - logoW) / 2, H - 230, logoW, logoH);
  }
}

// ─── Shared Utilities ────────────────────────────────────────

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  // Proxy external R2 URLs through our API to avoid CORS issues with canvas
  const fetchUrl = url.includes('r2.dev')
    ? `/api/proxy-image?url=${encodeURIComponent(url)}`
    : url;

  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
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
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

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
