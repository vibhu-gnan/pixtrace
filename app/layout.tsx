import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.in';

// Self-hosted at build time — removes a render-blocking request to fonts.googleapis.com
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'PIXTRACE - Event Photo Gallery & QR Code Sharing for Photographers',
    template: '%s | PIXTRACE',
  },
  description: 'PIXTRACE is the premium event gallery platform for photographers. Share original-quality photos with guests instantly via QR codes. Supports weddings, corporate events & more.',
  keywords: [
    'event photography gallery',
    'photo sharing platform',
    'QR code photo gallery',
    'wedding photo gallery',
    'event photo delivery',
    'photographer gallery tool',
    'photo sharing QR code',
    'online event gallery',
    'client photo delivery',
    'event gallery India',
  ],
  authors: [{ name: 'PIXTRACE', url: siteUrl }],
  creator: 'PIXTRACE',
  publisher: 'PIXTRACE',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // NOTE: no `alternates.canonical` here on purpose — a canonical set on the root
  // layout is inherited by every route that doesn't declare its own, which would
  // point the whole site at the homepage. Each indexable page sets its own.
  openGraph: {
    title: 'PIXTRACE - Event Photo Gallery & QR Code Sharing for Photographers',
    description: 'Share original-quality event photos with guests instantly via QR codes. The premium gallery platform for weddings, corporate events & more.',
    url: siteUrl,
    siteName: 'PIXTRACE',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'PIXTRACE - Event Photo Gallery Platform with QR Code Sharing',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PIXTRACE - Event Photo Gallery & QR Code Sharing',
    description: 'Share original-quality event photos via QR codes. The premium gallery platform for photographers.',
    images: ['/og-image.jpg'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const ICON_FONT_STYLESHEETS = [
  'https://fonts.googleapis.com/icon?family=Material+Icons&display=block',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block',
];

/**
 * The `media="print"` → `media="all"` trick for loading CSS off the critical
 * path, done entirely outside React.
 *
 * These <link> tags are deliberately NOT rendered as JSX: React 19 hoists
 * `<link rel="stylesheet">` into its managed-resource pipeline, so mutating the
 * `media` attribute before hydration produces a hydration-mismatch error that
 * `suppressHydrationWarning` does not silence. Creating the elements here means
 * React never owns them and never diffs them. The matching `rel="preload"` tags
 * *are* rendered by React — those are static, so they're safe.
 */
const ACTIVATE_ICON_FONTS = `
(function () {
  var hrefs = ${JSON.stringify(ICON_FONT_STYLESHEETS)};
  for (var i = 0; i < hrefs.length; i++) {
    (function (href) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.media = 'print';
      link.addEventListener('load', function () { link.media = 'all'; });
      document.head.appendChild(link);
    })(hrefs[i]);
  }
})();
`;

// PageSpeed flagged this ingest host as a preconnect candidate worth ~300ms of
// LCP. Derived from the DSN so it can never drift out of sync with Sentry config.
const sentryOrigin = (() => {
  try {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    return dsn ? new URL(dsn).origin : null;
  } catch {
    return null;
  }
})();

export const viewport: Viewport = {
  themeColor: '#101622',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        {/*
          Icon fonts only — Inter is self-hosted via next/font above.

          These are loaded off the critical rendering path: `rel="preload"`
          starts the download immediately at high priority, while the stylesheet
          itself is parked at media="print" (which browsers don't treat as
          render-blocking) and flipped to media="all" once it has loaded.

          `display=block` rather than `swap` is deliberate for icon fonts: with
          `swap` the browser paints the ligature's literal text first, so users
          briefly see the word "arrow_forward" where the arrow should be.
          `block` keeps that space blank until the glyphs arrive.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {sentryOrigin ? <link rel="preconnect" href={sentryOrigin} crossOrigin="anonymous" /> : null}
        {ICON_FONT_STYLESHEETS.map((href) => (
          <link key={href} rel="preload" as="style" href={href} />
        ))}
        <noscript>
          {ICON_FONT_STYLESHEETS.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: ACTIVATE_ICON_FONTS }} />
      </head>
      <body className="antialiased bg-background-dark font-display text-slate-200">
        {children}
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('error', function(e) {
                  if (e.message && e.message.includes('Loading chunk')) {
                    window.location.reload();
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
