import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="text-center max-w-lg">
        <h1 className="text-5xl font-bold text-gray-900 mb-3">PIXTRACE</h1>
        <p className="text-lg text-gray-500 mb-8">
          Event Gallery Platform for Photographers & Organizers
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Create Account
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
