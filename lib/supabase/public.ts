// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase public read-only client using the anon key.
 *
 * Used exclusively for public gallery reads (no auth required).
 * Unlike the SSR client (@supabase/ssr createServerClient), this client:
 *   - Does NOT read/write cookies — no session machinery
 *   - Does NOT run auth.getSession() or timezone introspection queries
 *   - Is a module-level singleton — created once per cold start, reused across requests
 *
 * Typed with `any` as the Database generic so all query results return
 * `any` data rather than `never` (which happens when no schema type is
 * provided to the untyped createClient overload).
 *
 * RLS on the `events` table enforces is_public=true for all reads made
 * with the anon key, so no data leakage is possible.
 *
 * NEVER use this client for writes or authenticated operations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPublicClient(): SupabaseClient<any> {
  if (_publicClient) return _publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _publicClient = createClient<any>(url, anonKey, {
    auth: {
      // Disable all session/token machinery — not needed for public reads
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return _publicClient;
}
