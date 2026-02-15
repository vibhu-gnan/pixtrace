import { createClient } from '@supabase/supabase-js';

/**
 * Supabase public read-only client using the anon key.
 *
 * Used exclusively for public gallery reads (no auth required).
 * Unlike the SSR client (@supabase/ssr createServerClient), this client:
 *   - Does NOT read/write cookies — no session machinery
 *   - Does NOT run auth.getSession() or timezone introspection queries
 *   - Is a module-level singleton — created once per cold start, reused across requests
 *
 * RLS on the `events` table enforces is_public=true for all reads made
 * with the anon key, so no data leakage is possible.
 *
 * NEVER use this client for writes or authenticated operations.
 */
let _publicClient: ReturnType<typeof createClient> | null = null;

export function getPublicClient(): ReturnType<typeof createClient> {
  if (_publicClient) return _publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  _publicClient = createClient(url, anonKey, {
    auth: {
      // Disable all session/token machinery — not needed for public reads
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return _publicClient;
}
