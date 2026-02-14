import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PIXTRACE - Event Gallery Platform",
  description: "Multi-tenant event gallery platform with AI-powered face search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
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
