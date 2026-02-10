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
      </body>
    </html>
  );
}
