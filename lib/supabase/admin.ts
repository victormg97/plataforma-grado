import { createClient } from '@supabase/supabase-js';

/**
 * Admin client using the secret key (sb_secret_* or service_role).
 * Only for server-side use — NEVER expose to the frontend.
 * Used for privileged operations like resetting another user's password.
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
