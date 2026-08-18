import type { Metadata } from 'next';

// Placeholder landing page with no standalone value — keep it out of the index.
export const metadata: Metadata = {
  title: 'Gallery',
  robots: { index: false, follow: false },
};

export default function GalleryIndexPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="text-center max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gallery</h1>
        <p className="text-gray-500">
          Use the link or QR code shared by the event organizer to view a gallery.
        </p>
      </div>
    </main>
  );
}
