import Link from 'next/link';

export default function GalleryNotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* Animated camera shutter icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full border-4 border-gray-700 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-gray-600 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-gray-700" />
          </div>
        </div>
        {/* Flash indicator */}
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
        </div>
      </div>

      <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 tracking-tight text-center">
        Oops, no flash here
      </h1>

      <p className="text-lg sm:text-xl text-gray-400 mb-2 text-center max-w-md">
        This gallery doesn&apos;t exist or hasn&apos;t been published yet.
      </p>

      <p className="text-sm text-gray-500 mb-10 text-center max-w-sm">
        The organizer may not have shared it yet, or the link might be outdated. Check with your event host for the correct gallery link.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="px-6 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors"
        >
          Go to PIXTRACE
        </Link>
      </div>

      {/* Subtle branding */}
      <p className="absolute bottom-6 text-xs text-gray-700">
        PIXTRACE &mdash; Every moment, beautifully captured
      </p>
    </div>
  );
}
