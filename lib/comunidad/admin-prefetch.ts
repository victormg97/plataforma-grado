import { QueryClient, dehydrate } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

/**
 * Server-side prefetch for the Comunidad Estratégica admin config panel.
 *
 * ONE RPC (get_game_admin_bootstrap) returns every tab's data; before, this
 * made ~16 separate queries. Modularity lives in SQL: the orchestrator is a
 * list of small per-domain sections (admin_list_game_badges,
 * admin_list_daily_questions, list_game_players, get_game_stats, ...), so
 * adding/changing a tab means editing one section + one entry in SECTIONS.
 *
 * Each section has EXACTLY the shape its GET route returns and is seeded under
 * the SAME queryKey the client hook uses, so React Query treats it as fresh
 * cache and every mutation's invalidations keep working unchanged.
 *
 * The RPC re-validates the admin role (get_current_user_rol). A Forbidden
 * error is reported as `forbidden` so the page can redirect.
 */

// bootstrap key → React Query key used by the admin hooks.
const SECTIONS: Record<string, readonly unknown[]> = {
  settings: ['game-settings'],
  point_sources: ['game-admin-point-sources'],
  streak_thresholds: ['game-admin-streak-thresholds'],
  levels: ['game-admin-levels'],
  challenges: ['game-admin-challenges'],
  weekly_cases: ['game-admin-weekly-cases'],
  score_reset_log: ['game-admin-score-reset-log'],
  badges: ['game-admin-badges'],
  daily_questions: ['game-admin-daily-questions'],
  stats: ['game-admin-stats'],
};

export async function prefetchComunidadAdmin(): Promise<{
  dehydratedState: ReturnType<typeof dehydrate>;
  forbidden: boolean;
}> {
  const queryClient = new QueryClient();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_game_admin_bootstrap', {
    p_tenant: tenantConfig.id,
  });

  if (error) {
    // On other errors render the panel anyway; each tab fetches on its own.
    return { dehydratedState: dehydrate(queryClient), forbidden: error.code === '42501' };
  }

  const bootstrap = (data ?? {}) as Record<string, unknown>;

  for (const [section, key] of Object.entries(SECTIONS)) {
    const value = bootstrap[section];
    if (value !== undefined && value !== null) queryClient.setQueryData(key, value);
  }

  // The players hook is keyed by its search term and expects { players }.
  queryClient.setQueryData(['game-admin-players', ''], {
    players: Array.isArray(bootstrap.players) ? bootstrap.players : [],
  });

  return { dehydratedState: dehydrate(queryClient), forbidden: false };
}
