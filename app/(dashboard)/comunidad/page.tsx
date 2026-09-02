import { redirect } from 'next/navigation';
import { HydrationBoundary } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import { prefetchGameData } from '@/lib/comunidad/game-prefetch';
import { GameThemeScope } from '@/components/comunidad/GameThemeScope';
import { GameShell } from '@/components/comunidad/GameShell';
import type { UserRol } from '@/lib/supabase/types';

/**
 * Entry page for the "Comunidad Estratégica" mini-app.
 *
 * Server component: it prefetches the whole game in ONE DB round-trip via the
 * get_game_bootstrap orchestrator, seeds the React Query cache, and hydrates
 * the client. The orchestrator computes `accessible` with the same rule as the
 * RLS gate (game_enabled && (all_users || (admin_only && admin))), so we gate
 * here server-side and redirect if the user can't access the game yet.
 */
export default async function ComunidadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dehydratedState, accessible } = await prefetchGameData();

  if (!accessible) {
    // Mirror the previous client redirect: send the user to their default page.
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();
    redirect(getRolRedirectPath((profile?.rol as UserRol) ?? 'alumno'));
  }

  return (
    <HydrationBoundary state={dehydratedState}>
      <GameThemeScope>
        <GameShell />
      </GameThemeScope>
    </HydrationBoundary>
  );
}
