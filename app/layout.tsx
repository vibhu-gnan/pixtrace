import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.in';

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
  alternates: {
    canonical: siteUrl,
  },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

        {/* Performance optimizations */}
        <meta name="theme-color" content="#101622" />
      </head>
      <body className="antialiased bg-background-dark font-display text-slate-200">
        {children}
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
