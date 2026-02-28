import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const logoPath = join(publicDir, 'logo.png');

async function generateOgImage() {
  // Create a 1200x630 OG image with dark background, logo, and text
  const bgColor = { r: 16, g: 22, b: 34, alpha: 1 }; // #101622 (background-dark)
  const primaryBlue = '#2b6cee';

  // Resize logo to fit nicely on the left side
  const logo = await sharp(logoPath)
    .resize(280, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Create an SVG overlay with text and gradient accents
  const svgOverlay = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${primaryBlue};stop-opacity:0.15" />
          <stop offset="100%" style="stop-color:#101622;stop-opacity:0" />
        </linearGradient>
        <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${primaryBlue};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#60a5fa;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Subtle gradient overlay -->
      <rect width="1200" height="630" fill="url(#grad)" />

      <!-- Top accent line -->
      <rect x="80" y="60" width="120" height="4" rx="2" fill="${primaryBlue}" opacity="0.6" />

      <!-- Brand name -->
      <text x="80" y="240" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="800" fill="white" letter-spacing="-1">PIXTRACE</text>

      <!-- Tagline -->
      <text x="80" y="310" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="400" fill="#94a3b8">Event Photo Gallery Platform</text>

      <!-- Description -->
      <text x="80" y="380" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="#64748b">Share original-quality photos via QR codes.</text>
      <text x="80" y="412" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="#64748b">Perfect for weddings, events &amp; parties.</text>

      <!-- URL badge -->
      <rect x="80" y="470" width="200" height="40" rx="20" fill="${primaryBlue}" opacity="0.15" />
      <text x="115" y="497" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600" fill="${primaryBlue}">pixtrace.in</text>

      <!-- Bottom accent -->
      <rect x="0" y="622" width="1200" height="8" fill="${primaryBlue}" opacity="0.4" />

      <!-- Decorative dots grid (right side background) -->
      ${Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 6 }, (_, col) =>
          `<circle cx="${850 + col * 40}" cy="${100 + row * 50}" r="2" fill="#334155" opacity="0.4" />`
        ).join('')
      ).join('')}
    </svg>
  `;

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: bgColor,
    },
  })
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
      {
        input: logo,
        top: 175,
        left: 850,
      },
    ])
    .jpeg({ quality: 90 })
    .toFile(join(publicDir, 'og-image.jpg'));

  console.log('✅ Created og-image.jpg (1200x630)');
}

async function generateFavicon() {
  // Create a 48x48 favicon from the logo (ICO needs to be small)
  // First create a 32x32 PNG, then we'll use it as favicon
  await sharp(logoPath)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon-32x32.png'));

  // Create 16x16 version
  await sharp(logoPath)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon-16x16.png'));

  // For favicon.ico, we create a PNG-based one (modern browsers support PNG favicons)
  // We'll create a 48x48 version as the main favicon
  await sharp(logoPath)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon.ico'));

  console.log('✅ Created favicon.ico (48x48)');
  console.log('✅ Created favicon-16x16.png');
  console.log('✅ Created favicon-32x32.png');
}

async function generateAppleTouchIcon() {
  // Apple touch icon needs to be 180x180 with no transparency
  // Use a dark background that matches the app theme
  const bgColor = { r: 16, g: 22, b: 34, alpha: 255 }; // #101622

  const logo = await sharp(logoPath)
    .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: bgColor,
    },
  })
    .composite([
      {
        input: logo,
        top: 20,
        left: 20,
      },
    ])
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));

  console.log('✅ Created apple-touch-icon.png (180x180)');
}

async function main() {
  try {
    await generateOgImage();
    await generateFavicon();
    await generateAppleTouchIcon();
    console.log('\n🎉 All SEO assets generated successfully!');
  } catch (err) {
    console.error('Error generating assets:', err);
    process.exit(1);
  }
}

main();
