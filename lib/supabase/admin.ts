import { createClient } from '@supabase/supabase-js';

// Admin client using service_role_key — SERVER-SIDE ONLY
// This bypasses RLS and has full access to the database
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
