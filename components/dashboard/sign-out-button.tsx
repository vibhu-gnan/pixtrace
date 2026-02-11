'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/auth/client';

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    try {
      setError(null);
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      router.push('/sign-in');
      router.refresh();
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out');
    }
  };

  return (
    <>
      <button
        onClick={handleSignOut}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOutIcon />
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-red-50 text-red-800 text-xs rounded-md shadow-lg z-50">
          {error}
        </div>
      )}
    </>
  );
}
