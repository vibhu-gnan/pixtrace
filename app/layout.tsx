import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PIXTRACE - Premium Event Gallery",
  description: "The premium gallery platform that delivers original quality photos to your guests instantly via simple QR codes.",
  keywords: ["event photography", "gallery platform", "photo sharing", "QR code gallery", "photographer tools"],
  authors: [{ name: "PIXTRACE Inc." }],
  creator: "PIXTRACE Inc.",
  publisher: "PIXTRACE Inc.",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://pixtrace.com'),
  openGraph: {
    title: "PIXTRACE - Premium Event Gallery",
    description: "The premium gallery platform that delivers original quality photos to your guests instantly via simple QR codes.",
    url: "https://pixtrace.com",
    siteName: "PIXTRACE",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "PIXTRACE - Premium Event Gallery Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PIXTRACE - Premium Event Gallery",
    description: "The premium gallery platform that delivers original quality photos to your guests instantly via simple QR codes.",
    images: ["/og-image.jpg"],
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
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
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
