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
  '/api/import/cleanup',
  '/api/cron/storage-cleanup',
  '/api/health',
  '/sign-in',
  '/sign-up',
  '/pricing',
  '/enterprise',
  '/auth/callback',
];

// The ONLY paths we want in search results. Everything else this middleware
// sees — event galleries, auth screens, the dashboard — is unlisted.
const INDEXABLE_PATHS = new Set(['/', '/pricing', '/enterprise']);

function setSecurityHeaders(response: NextResponse) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'on');
}

/**
 * Event galleries are link-only: anyone holding the URL can open them, but they
 * must never appear in Search or Google Image search. Setting this here rather
 * than in next.config.ts is deliberate — a gallery lives at the bare `/<slug>`
 * root, which can't be path-matched without also catching `/pricing`, and this
 * file already owns the slug-vs-app-route distinction.
 *
 * `noimageindex` is the directive that actually keeps guests' faces out of
 * Google Images. Social scrapers (WhatsApp, Instagram, Twitter) ignore all of
 * this, so shared-link previews keep working.
 */
function setNoIndexHeader(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noimageindex, noarchive');
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
    if (!INDEXABLE_PATHS.has(pathname)) setNoIndexHeader(response);
    return response;
  }

  // ─── Protected routes: authenticate ───
  const { user, response } = await updateSession(request);

  if (!user) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(signInUrl);
    setSecurityHeaders(redirectResponse);
    setNoIndexHeader(redirectResponse);
    return redirectResponse;
  }

  // Nothing behind auth should ever be indexed.
  setSecurityHeaders(response);
  setNoIndexHeader(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|robots\\.txt|sitemap\\.xml|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
