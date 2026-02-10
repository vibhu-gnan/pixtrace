import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client using service_role key.
 * Bypasses RLS - only use in Server Actions and API routes.
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
