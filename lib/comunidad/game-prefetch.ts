import { QueryClient, dehydrate } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';
import { seedGameState, type GameState } from './game-state';

/**
 * Server-side prefetch for the PLAYER game (Comunidad Estratégica).
 *
 * One DB round-trip: calls the get_game_bootstrap orchestrator RPC (which
 * internally composes get_game_state with every section) and seeds every
 * player query under the exact queryKey its hook uses. With the cache warm and
 * the hooks' staleTimes, opening the game and switching between its main tabs
 * is instant and adds no extra DB calls for the (many) concurrent players.
 *
 * Returns the dehydrated state for a HydrationBoundary, plus `accessible` so
 * the page can decide whether to render the game at all.
 */

type GameBootstrap = GameState & { accessible: boolean };

export async function prefetchGameData(): Promise<{
  dehydratedState: ReturnType<typeof dehydrate>;
  accessible: boolean;
}> {
  const queryClient = new QueryClient();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_game_bootstrap', {
    p_tenant: tenantConfig.id,
  });

  const bootstrap = (data ?? null) as GameBootstrap | null;

  // On error or not accessible, return an empty cache; the page redirects.
  if (error || !bootstrap || !bootstrap.accessible) {
    return { dehydratedState: dehydrate(queryClient), accessible: !!bootstrap?.accessible };
  }

  seedGameState(queryClient, bootstrap);

  return { dehydratedState: dehydrate(queryClient), accessible: true };
}
