import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Update session
  const { user, response } = await updateSession(request);

  // Public routes - no auth required
  const publicRoutes = [
    '/gallery',
    '/api/gallery',
    '/sign-in',
    '/sign-up',
    '/',
  ];

  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Allow public routes
  if (isPublicRoute) {
    return response;
  }

  // Protected routes - require authentication
  if (!user && !isPublicRoute) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
