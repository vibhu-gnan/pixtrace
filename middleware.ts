import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware';

// Routes that never need auth — skip supabase.auth.getUser() entirely
const PUBLIC_PREFIXES = [
  '/gallery',
  '/api/gallery',
  '/api/download',
  '/api/webhooks',
  '/api/proxy-image',
  '/api/face',
  '/sign-in',
  '/sign-up',
  '/pricing',
  '/enterprise',
  '/auth/callback',
];

function setSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Public routes: pass through without touching Supabase Auth ───
  // This is critical for performance — 2K gallery viewers should NOT
  // each trigger a supabase.auth.getUser() call on every request.
  const isPublicRoute = PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));

  // Short slug routes (e.g., /abc123 for gallery) — check if it looks like an event hash
  // Event hashes are 12-char nanoid strings, no slashes after the first segment
  // Exclude known app routes to prevent auth bypass on /dashboard, /settings, etc.
  const KNOWN_APP_ROUTES = new Set([
    '/dashboard', '/settings', '/billing', '/events', '/profile', '/account',
    '/onboarding', '/create', '/manage', '/admin', '/analytics',
  ]);
  const isSlugRoute = /^\/[a-zA-Z0-9_-]{6,32}$/.test(pathname) && !KNOWN_APP_ROUTES.has(pathname);

  if (isPublicRoute || isSlugRoute || pathname === '/') {
    const response = NextResponse.next();
    setSecurityHeaders(response);
    return response;
  }

  // ─── Protected routes: authenticate ───
  const { user, response } = await updateSession(request);

  if (!user) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  setSecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|robots\\.txt|sitemap\\.xml|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
