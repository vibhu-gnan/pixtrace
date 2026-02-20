'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/auth/client';
import Link from 'next/link';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getSafeRedirect = () => {
    const redirect = searchParams.get('redirect');
    if (!redirect) return '/';
    if (!redirect.startsWith('/')) return '/';
    return redirect;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const redirectPath = getSafeRedirect();

      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    const redirectPath = getSafeRedirect();

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${baseUrl}/auth/callback?redirect=${encodeURIComponent(
          redirectPath
        )}`,
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-dark px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Sign in to PIXTRACE
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Welcome back! Please sign in to your account.
          </p>
        </div>

        {/* Google Sign In */}
        <div>
          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-md glass-panel px-3 py-3 text-sm font-medium text-slate-300 border border-white/10 hover:bg-white/5 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background-dark px-2 text-slate-500">or</span>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSignIn}>
          {error && (
            <div className="rounded-md bg-red-900/50 border border-red-500/50 p-4">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <div className="-space-y-px rounded-md shadow-sm">
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="relative block w-full rounded-t-md border-0 py-3 px-4 bg-slate-800/50 text-white ring-1 ring-inset ring-slate-600 placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="relative block w-full rounded-b-md border-0 py-3 px-4 bg-slate-800/50 text-white ring-1 ring-inset ring-slate-600 placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-3 py-3 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="text-center text-sm">
            <span className="text-slate-400">New to PIXTRACE? </span>
            <Link
              href="/pricing"
              className="font-medium text-primary hover:text-blue-400"
            >
              View Pricing Plans
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
