'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/auth/client';
import type { User } from '@/types';
import { LoadingSpinner } from '@/components/UI/LoadingStates';

export default function Navigation() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Transform Supabase user to our User type
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            full_name: session.user.user_metadata?.full_name,
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          };
          setUser(userData);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setError('Failed to check authentication status');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            full_name: session.user.user_metadata?.full_name,
            avatar_url: session.user.user_metadata?.avatar_url,
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          };
          setUser(userData);
        } else {
          setUser(null);
        }
        setError(null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out failed:', err);
      setError('Failed to sign out');
    }
  };

  if (loading) {
    return (
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background-dark/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
              <span className="material-icons text-white text-lg">filter_center_focus</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">PIXTRACE</span>
          </div>
          <div className="flex items-center gap-4">
            <LoadingSpinner size="sm" />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background-dark/80 backdrop-blur-md" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden group-hover:scale-105 transition-transform">
            <img 
              src="/logo.png" 
              alt="PIXTRACE Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">PIXTRACE</span>
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <Link className="hover:text-white transition-colors focus:outline-none focus:text-white" href="/#features">Features</Link>
          <Link className="hover:text-white transition-colors focus:outline-none focus:text-white" href="/pricing">Pricing</Link>
        </div>
        
        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Toggle mobile menu"
        >
          <span className="material-icons text-2xl">
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background-dark border-b border-white/5 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
            <Link 
              className="block text-sm font-medium text-slate-400 hover:text-white transition-colors focus:outline-none focus:text-white py-2" 
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link 
              className="block text-sm font-medium text-slate-400 hover:text-white transition-colors focus:outline-none focus:text-white py-2" 
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <div className="pt-4 border-t border-white/10">
              {user ? (
                <div className="space-y-2">
                  <Link 
                    href="/dashboard" 
                    className="block text-sm font-medium text-slate-300 hover:text-white transition-colors focus:outline-none focus:text-white py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors focus:outline-none focus:text-white"
                    aria-label="Sign out"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link 
                  className="block px-5 py-2.5 bg-primary hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-all text-center"
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Sign in to your account"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Desktop Auth Section */}
      <div className="hidden md:flex items-center gap-4">
        {error && (
          <div className="text-xs text-red-400" role="alert">
            {error}
          </div>
        )}
        
        {user ? (
          <>
            <Link 
              href="/dashboard" 
              className="hidden md:block text-sm font-medium text-slate-300 hover:text-white transition-colors focus:outline-none focus:text-white"
              aria-label="Go to dashboard"
            >
              Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors focus:outline-none focus:text-white"
              aria-label="Sign out"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link 
            className="px-5 py-2.5 bg-primary hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-all shadow-[0_0_20px_-5px_rgba(43,108,238,0.5)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background-dark" 
            href="/sign-in"
            aria-label="Sign in to your account"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
