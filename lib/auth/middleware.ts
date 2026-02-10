import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

// #region agent log
const DEBUG_LOG = (msg: string, data: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7242/ingest/1f745aed-d317-47c8-8162-2ef13bf53e70', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'lib/auth/middleware.ts', message: msg, data, timestamp: Date.now(), hypothesisId: 'A' }) }).catch(() => {});
};
// #endregion

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    // #region agent log
    DEBUG_LOG('getUser called', { pathname: request.nextUrl.pathname });
    // #endregion
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // #region agent log
    DEBUG_LOG('getUser result', { hasUser: !!user });
    // #endregion
    return { user, response: supabaseResponse };
  } catch (e) {
    // #region agent log
    DEBUG_LOG('getUser threw', { error: String(e) });
    // #endregion
    return { user: null, response: supabaseResponse };
  }
}
