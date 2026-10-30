import { redirect } from 'next/navigation';
import { HydrationBoundary } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { AdminPanel } from '@/components/comunidad/admin/AdminPanel';
import { prefetchComunidadAdmin } from '@/lib/comunidad/admin-prefetch';

/**
 * Dedicated admin route for Comunidad Estratégica configuration (Req. 9).
 * Server-side admin guard mirrors the pattern of app/(dashboard)/admin/recursos.
 * The panel uses global platform tokens (not the GameThemeScope skin).
 *
 * All config data for every tab is prefetched server-side and seeded into the
 * React Query cache via HydrationBoundary, so switching tabs is instant (no
 * per-tab loading spinner). Mutations keep the cache fresh through their normal
 * invalidations.
 */
export default async function AdminComunidadPage() {
  const supabase = await createClient();
  // Local JWT verification (no extra Auth round-trip). The admin role is
  // enforced by the bootstrap RPC itself, so no separate profile query.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect('/login');

  const { dehydratedState, forbidden } = await prefetchComunidadAdmin();
  if (forbidden) redirect('/');

  return (
    <HydrationBoundary state={dehydratedState}>
      <AdminPanel />
    </HydrationBoundary>
  );
}
