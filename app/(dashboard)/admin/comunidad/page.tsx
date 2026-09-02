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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') redirect('/');

  const dehydratedState = await prefetchComunidadAdmin();

  return (
    <HydrationBoundary state={dehydratedState}>
      <AdminPanel />
    </HydrationBoundary>
  );
}
