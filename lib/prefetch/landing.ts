import { QueryClient, dehydrate } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Prefetch landing page data at server-render time.
 * Uses service_role to bypass session-based auth (landing is public).
 *
 * The dehydrated state is passed to HydrationBoundary so the client
 * has data immediately — no flash, no loading spinners.
 */
export async function prefetchLandingData(tenantSlug: string) {
  const queryClient = new QueryClient();

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all landing configs in parallel
  const [planesResult, sobreNosotrasResult] = await Promise.all([
    supabase
      .from('landing_planes_config')
      .select('*')
      .eq('tenant_slug', tenantSlug)
      .single(),
    supabase
      .from('landing_sobre_nosotras_config')
      .select('*')
      .eq('tenant_slug', tenantSlug)
      .single(),
  ]);

  if (planesResult.data) {
    queryClient.setQueryData(['landing-planes-config', tenantSlug], planesResult.data);
  }

  if (sobreNosotrasResult.data) {
    queryClient.setQueryData(['landing-sobre-nosotras-config', tenantSlug], sobreNosotrasResult.data);
  }

  return dehydrate(queryClient);
}
