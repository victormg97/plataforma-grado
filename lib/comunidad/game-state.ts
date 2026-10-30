import type { QueryClient } from '@tanstack/react-query';

/**
 * Sections returned by the get_game_state RPC (and get_game_bootstrap).
 * Each one maps 1:1 to the React Query key its hook uses, so a single RPC
 * response can refresh many screens at once instead of N separate fetches.
 */
export const GAME_STATE_PARTS = [
  'settings',
  'profile',
  'daily_question',
  'daily_review',
  'quiz_subjects',
  'quiz_categories',
  'ranking',
  'challenges',
  'badges',
  'weekly_case',
] as const;

export type GameStatePart = (typeof GAME_STATE_PARTS)[number];

export type GameState = Partial<Record<GameStatePart, unknown>>;

const QUERY_KEYS: Record<Exclude<GameStatePart, 'ranking' | 'quiz_categories'>, readonly unknown[]> = {
  settings: ['game-settings'],
  profile: ['game-profile'],
  daily_question: ['game-daily-question'],
  daily_review: ['game-daily-review'],
  quiz_subjects: ['game-quiz-subjects'],
  challenges: ['game-challenges'],
  badges: ['game-badges'],
  weekly_case: ['game-weekly-case'],
};

export function isGameStatePart(value: string): value is GameStatePart {
  return (GAME_STATE_PARTS as readonly string[]).includes(value);
}

/**
 * Writes every section present in `state` into the query cache under the key
 * its hook reads. Works for the server prefetch QueryClient and the browser's.
 */
export function seedGameState(qc: QueryClient, state: GameState | null | undefined) {
  if (!state) return;
  for (const part of GAME_STATE_PARTS) {
    const value = state[part];
    if (value === undefined || value === null) continue;
    if (part === 'ranking') {
      // useInfiniteQuery shape; month = null = current month (first page).
      qc.setQueryData(['game-ranking', null], { pages: [value], pageParams: [0] });
    } else if (part === 'quiz_categories') {
      // { [subjectId]: { categories } } → one cache entry per subject, so
      // opening any subject's categories is instant (no request).
      for (const [subjectId, categories] of Object.entries(value as Record<string, unknown>)) {
        qc.setQueryData(['game-quiz-categories', subjectId], categories);
      }
    } else {
      qc.setQueryData(QUERY_KEYS[part], value);
    }
  }
}
