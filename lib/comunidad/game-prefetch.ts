import { QueryClient, dehydrate } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { tenantConfig } from '@/config';

/**
 * Server-side prefetch for the PLAYER game (Comunidad Estratégica).
 *
 * One DB round-trip: calls the get_game_bootstrap orchestrator RPC (which
 * internally composes the per-tab read sub-RPCs) and seeds every player query
 * under the exact queryKey its hook uses. With the cache warm and the hooks'
 * staleTimes, opening the game and switching between its main tabs is instant
 * and adds no extra DB calls for the (many) concurrent players.
 *
 * Returns the dehydrated state for a HydrationBoundary, plus `accessible` so
 * the page can decide whether to render the game at all.
 */

interface GameBootstrap {
  accessible: boolean;
  settings?: unknown;
  profile?: unknown;
  daily_question?: unknown;
  daily_review?: unknown;
  quiz_subjects?: unknown;
  ranking?: unknown;
  challenges?: unknown;
  badges?: unknown;
  weekly_case?: unknown;
}

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

  // On error or not accessible, return an empty cache; the client will gate
  // and redirect as it does today.
  if (error || !bootstrap || !bootstrap.accessible) {
    return { dehydratedState: dehydrate(queryClient), accessible: !!bootstrap?.accessible };
  }

  // Seed each query under the exact key its hook uses.
  if (bootstrap.settings) queryClient.setQueryData(['game-settings'], bootstrap.settings);
  if (bootstrap.profile) queryClient.setQueryData(['game-profile'], bootstrap.profile);
  if (bootstrap.daily_question) queryClient.setQueryData(['game-daily-question'], bootstrap.daily_question);
  if (bootstrap.daily_review) queryClient.setQueryData(['game-daily-review'], bootstrap.daily_review);
  if (bootstrap.quiz_subjects) queryClient.setQueryData(['game-quiz-subjects'], bootstrap.quiz_subjects);
  if (bootstrap.challenges) queryClient.setQueryData(['game-challenges'], bootstrap.challenges);
  if (bootstrap.badges) queryClient.setQueryData(['game-badges'], bootstrap.badges);
  if (bootstrap.weekly_case) queryClient.setQueryData(['game-weekly-case'], bootstrap.weekly_case);

  // Ranking uses useInfiniteQuery — seed as the first page (month = null =
  // current month), matching the ['game-ranking', null] key and page shape.
  if (bootstrap.ranking) {
    queryClient.setQueryData(['game-ranking', null], {
      pages: [bootstrap.ranking],
      pageParams: [0],
    });
  }

  return { dehydratedState: dehydrate(queryClient), accessible: true };
}
