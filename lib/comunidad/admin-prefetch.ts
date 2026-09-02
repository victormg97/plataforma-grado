import { QueryClient, dehydrate } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenantConfig } from '@/config';
import type { AdminBadge } from '@/lib/comunidad/badge';
import type { AdminDailyQuestionRow } from '@/lib/hooks/useComunidadAdmin';

/**
 * Server-side prefetch for the Comunidad Estratégica admin config panel.
 *
 * Design goals (per product decision):
 *  - NOT a single monolithic RPC. Each config domain is fetched by its own
 *    small, independent function below, so adding/changing a tab means editing
 *    one loader + one seed line — nothing else.
 *  - All loaders run in parallel (Promise.all), so warming the whole panel is
 *    one round-trip's worth of latency.
 *  - Each loader returns EXACTLY the shape its matching GET route returns, and
 *    is seeded under the SAME queryKey the client hook uses. That way React
 *    Query treats the seeded data as fresh cache, and every existing mutation
 *    (which invalidates by those keys) keeps the panel up to date with no extra
 *    wiring.
 *
 * Only called from the admin/comunidad server route, which already validated
 * that the caller is an admin — so using the service-role client here is safe
 * and mirrors lib/prefetch/dashboard.ts.
 */

type Admin = ReturnType<typeof createAdminClient>;

const T = tenantConfig.id;

// ─── Individual domain loaders (one per tab / query) ──────────────────────────
// Each mirrors the shape of its GET route so the seeded cache matches exactly.

async function loadSettings(admin: Admin) {
  const { data } = await admin.from('game_settings').select('*').eq('tenant', T).maybeSingle();
  return data ?? null;
}

async function loadPointSources(admin: Admin) {
  const { data } = await admin
    .from('game_point_sources')
    .select('*')
    .eq('tenant', T)
    .order('action_type');
  return data ?? [];
}

async function loadStreakThresholds(admin: Admin) {
  const { data } = await admin
    .from('game_streak_thresholds')
    .select('*')
    .eq('tenant', T)
    .order('days');
  return data ?? [];
}

async function loadLevels(admin: Admin) {
  const { data } = await admin
    .from('game_level_thresholds')
    .select('*')
    .eq('tenant', T)
    .order('level');
  return data ?? [];
}

async function loadChallenges(admin: Admin) {
  const { data } = await admin
    .from('game_challenges')
    .select('*')
    .eq('tenant', T)
    .order('created_at', { ascending: false });
  return data ?? [];
}

async function loadWeeklyCases(admin: Admin) {
  const { data } = await admin
    .from('game_weekly_cases')
    .select('*')
    .eq('tenant', T)
    .order('window_start', { ascending: false });
  return data ?? [];
}

async function loadScoreResetLog(admin: Admin) {
  const { data } = await admin
    .from('game_score_reset_log')
    .select('id, executed_by, executed_at, reset_scope')
    .eq('tenant', T)
    .order('executed_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

/** Badges enriched with a grant_count (mirrors the badges GET route). */
async function loadBadges(admin: Admin): Promise<AdminBadge[]> {
  const [{ data: badges }, { data: counts }] = await Promise.all([
    admin
      .from('game_badges')
      .select('*')
      .eq('tenant', T)
      .order('series_key', { ascending: true, nullsFirst: false })
      .order('series_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true }),
    admin.from('user_badges').select('badge_id').eq('tenant', T),
  ]);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    countMap.set(row.badge_id, (countMap.get(row.badge_id) ?? 0) + 1);
  }

  return (badges ?? []).map((b) => ({
    ...(b as unknown as AdminBadge),
    grant_count: countMap.get(b.id) ?? 0,
  }));
}

/** Curated daily questions enriched with content + subject (mirrors GET route). */
async function loadDailyQuestions(admin: Admin): Promise<AdminDailyQuestionRow[]> {
  const { data: rows } = await admin
    .from('game_daily_questions')
    .select('id, question_date, question_id, is_manually_curated')
    .eq('tenant', T)
    .order('question_date', { ascending: false })
    .limit(60);

  const list = rows ?? [];
  const questionIds = [...new Set(list.map((r) => r.question_id).filter(Boolean))] as string[];

  const questionMap = new Map<
    string,
    { content: string; type: string; subject_name: string | null }
  >();

  if (questionIds.length > 0) {
    const { data: questions } = await admin
      .from('qb_questions')
      .select('id, content, type, subject_id')
      .eq('tenant', T)
      .in('id', questionIds);

    const subjectIds = [
      ...new Set((questions ?? []).map((q) => q.subject_id).filter(Boolean)),
    ] as string[];

    const subjectMap = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await admin.from('qb_subjects').select('id, name').in('id', subjectIds);
      for (const s of subjects ?? []) subjectMap.set(s.id, s.name);
    }

    for (const q of questions ?? []) {
      questionMap.set(q.id, {
        content: q.content,
        type: q.type,
        subject_name: q.subject_id ? subjectMap.get(q.subject_id) ?? null : null,
      });
    }
  }

  return list.map((r) => {
    const q = r.question_id ? questionMap.get(r.question_id) : undefined;
    return {
      ...(r as AdminDailyQuestionRow),
      question_content: q?.content ?? null,
      question_type: q?.type ?? null,
      subject_name: q?.subject_name ?? null,
    };
  });
}

/**
 * Warm the React Query cache for the admin config panel and return the
 * dehydrated state for a HydrationBoundary.
 */
export async function prefetchComunidadAdmin() {
  const queryClient = new QueryClient();
  const admin = createAdminClient();
  const supabase = await createClient();

  // Session-scoped RPCs (re-validate admin internally): players + stats.
  const playersPromise = supabase.rpc('list_game_players', { p_tenant: T, p_search: '' });
  const statsPromise = supabase.rpc('get_game_stats', { p_tenant: T });

  const [
    settings,
    pointSources,
    streakThresholds,
    levels,
    challenges,
    weeklyCases,
    scoreResetLog,
    badges,
    dailyQuestions,
    playersResult,
    statsResult,
  ] = await Promise.all([
    loadSettings(admin),
    loadPointSources(admin),
    loadStreakThresholds(admin),
    loadLevels(admin),
    loadChallenges(admin),
    loadWeeklyCases(admin),
    loadScoreResetLog(admin),
    loadBadges(admin),
    loadDailyQuestions(admin),
    playersPromise,
    statsPromise,
  ]);

  // Seed each query under the exact key its client hook uses.
  if (settings) queryClient.setQueryData(['game-settings'], settings);
  queryClient.setQueryData(['game-admin-point-sources'], pointSources);
  queryClient.setQueryData(['game-admin-streak-thresholds'], streakThresholds);
  queryClient.setQueryData(['game-admin-levels'], levels);
  queryClient.setQueryData(['game-admin-challenges'], challenges);
  queryClient.setQueryData(['game-admin-weekly-cases'], weeklyCases);
  queryClient.setQueryData(['game-admin-score-reset-log'], scoreResetLog);
  queryClient.setQueryData(['game-admin-badges'], badges);
  queryClient.setQueryData(['game-admin-daily-questions'], dailyQuestions);

  // list_game_players already returns { players: [...] }; normalize defensively.
  const players = Array.isArray(playersResult.data)
    ? playersResult.data
    : (playersResult.data as { players?: unknown } | null)?.players ?? [];
  queryClient.setQueryData(['game-admin-players', ''], { players });

  if (statsResult.data) {
    queryClient.setQueryData(['game-admin-stats'], statsResult.data);
  }

  return dehydrate(queryClient);
}
