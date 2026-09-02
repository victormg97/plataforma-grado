'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import type { GameSettings } from '@/lib/supabase/types';
import type { DailyAnswer, DailyAnswerResult } from '@/lib/comunidad/answer';
import type {
  QuizStartPayload,
  QuizStartResult,
  QuizSubmitPayload,
  QuizSubmitResult,
  MonthlyRankingResult,
  ActiveChallengesResult,
  QuizSubject,
  QuizCategoriesResult,
} from '@/lib/comunidad/quiz';
import type { UserBadgesResult } from '@/lib/comunidad/badge';
import type {
  WeeklyCaseResult,
  WeeklyCaseHistoryResult,
  WeeklyCaseAnswerPayload,
  SubmitWeeklyCaseAnswerResult,
} from '@/lib/comunidad/weekly-case';
import type { GameProfileResult } from '@/lib/comunidad/game-config';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Subset of game_settings the API returns (fail-safe defaults included). */
export type GameSettingsResponse = Pick<
  GameSettings,
  | 'tenant'
  | 'game_enabled'
  | 'game_visibility'
  | 'display_name'
  | 'nickname_change_cooldown_days'
  | 'section_name_daily_question'
  | 'section_name_streak'
  | 'section_name_ranking'
  | 'section_name_challenges'
  | 'section_name_badges'
  | 'section_name_weekly_case'
  | 'icon'
  | 'hero_image_path'
  | 'recent_achievements_count'
  | 'lives_enabled'
  | 'lives_max'
  | 'lives_start'
  | 'lives_block_when_empty'
  | 'lives_regen_mode'
  | 'lives_regen_hours'
>;

/** Extended player profile (get_game_profile RPC): streak + lives + level +
 * recent achievements + moderation state. */
export type GameProfileResponse = GameProfileResult;

export interface DailyQuestionOption {
  text: string;
}

export type DailyQuestionType = 'single_choice' | 'multiple_choice' | 'true_false';

export interface DailyQuestionResponse {
  question: {
    id: string;
    type: DailyQuestionType;
    content: string;
    options: DailyQuestionOption[] | Record<string, never>;
  } | null;
  already_answered: boolean;
}

// ─── Queries ────────────────────────────────────────────────────────────────

async function fetchGameSettings(): Promise<GameSettingsResponse> {
  const res = await fetch('/api/game/settings');
  if (!res.ok) throw new Error('Error cargando configuración del juego');
  return res.json();
}

export function useGameSettings() {
  return useQuery({
    queryKey: ['game-settings'],
    queryFn: fetchGameSettings,
    staleTime: 5 * 60_000,
  });
}

async function fetchGameProfile(): Promise<GameProfileResponse> {
  const res = await fetch('/api/game/profile');
  if (!res.ok) throw new Error('Error cargando perfil de jugador');
  return res.json();
}

export function useGameProfile(enabled = true) {
  return useQuery({
    queryKey: ['game-profile'],
    queryFn: fetchGameProfile,
    staleTime: 30_000,
    enabled,
  });
}

async function fetchDailyQuestion(): Promise<DailyQuestionResponse> {
  const res = await fetch('/api/game/daily-question');
  if (!res.ok) throw new Error('Error cargando la pregunta del día');
  return res.json();
}

export function useDailyQuestion(enabled = true) {
  return useQuery({
    queryKey: ['game-daily-question'],
    queryFn: fetchDailyQuestion,
    staleTime: 60_000,
    enabled,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export interface NicknameError {
  error: string;
  days_remaining?: number;
}

export function useUpdateNickname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nickname: string) => {
      const res = await fetch('/api/game/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err: NicknameError = json;
        throw err;
      }
      return json as { ok: true; nickname: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-profile'] }),
  });
}

export function useAnswerDailyQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answer: DailyAnswer): Promise<DailyAnswerResult> => {
      const res = await fetch('/api/game/daily-question/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error enviando la respuesta');
      return json as DailyAnswerResult;
    },
    onSuccess: () => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['game-profile'] }),
        qc.invalidateQueries({ queryKey: ['game-daily-question'] }),
        qc.invalidateQueries({ queryKey: ['game-badges'] }),
      ]);
    },
  });
}

// ─── Slice 2: Cuestionarios, Ranking y Desafíos ──────────────────────────────

// ── Cuestionarios ──

async function fetchQuizSubjects(): Promise<{ subjects: QuizSubject[] }> {
  const res = await fetch('/api/game/quiz/subjects');
  if (!res.ok) throw new Error('Error cargando materias');
  return res.json();
}

export function useQuizSubjects(enabled = true) {
  return useQuery({
    queryKey: ['game-quiz-subjects'],
    queryFn: fetchQuizSubjects,
    staleTime: 5 * 60_000,
    enabled,
  });
}

async function fetchQuizCategories(subjectId: string): Promise<QuizCategoriesResult> {
  const res = await fetch(`/api/game/quiz/categories?subject=${encodeURIComponent(subjectId)}`);
  if (!res.ok) throw new Error('Error cargando categorías');
  return res.json();
}

export function useQuizCategories(subjectId: string | null) {
  return useQuery({
    queryKey: ['game-quiz-categories', subjectId],
    queryFn: () => fetchQuizCategories(subjectId as string),
    staleTime: 5 * 60_000,
    enabled: !!subjectId,
  });
}

export function useStartQuiz() {
  return useMutation({
    mutationFn: async (payload: QuizStartPayload): Promise<QuizStartResult> => {
      const res = await fetch('/api/game/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error iniciando el cuestionario');
      return json as QuizStartResult;
    },
  });
}

export function useSubmitQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: QuizSubmitPayload): Promise<QuizSubmitResult> => {
      const res = await fetch('/api/game/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error enviando el cuestionario');
      return json as QuizSubmitResult;
    },
    onSuccess: () => {
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['game-profile'] }),
        qc.invalidateQueries({ queryKey: ['game-ranking'] }),
        qc.invalidateQueries({ queryKey: ['game-challenges'] }),
        qc.invalidateQueries({ queryKey: ['game-badges'] }),
      ]);
    },
  });
}

// ── Ranking mensual (paginado con useInfiniteQuery) ──

const RANKING_PAGE_SIZE = 20;

async function fetchRankingPage(
  month: string | null,
  offset: number
): Promise<MonthlyRankingResult> {
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  params.set('limit', String(RANKING_PAGE_SIZE));
  params.set('offset', String(offset));
  const res = await fetch(`/api/game/ranking?${params.toString()}`);
  if (!res.ok) throw new Error('Error cargando el ranking');
  return res.json();
}

/** month: 'YYYY-MM' or null for the current month. */
export function useMonthlyRanking(month: string | null = null, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['game-ranking', month],
    queryFn: ({ pageParam = 0 }) => fetchRankingPage(month, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total_entries ? nextOffset : undefined;
    },
    staleTime: 60_000,
    enabled,
  });
}

// ── Desafíos activos ──

async function fetchActiveChallenges(): Promise<ActiveChallengesResult> {
  const res = await fetch('/api/game/challenges');
  if (!res.ok) throw new Error('Error cargando los desafíos');
  return res.json();
}

export function useActiveChallenges(enabled = true) {
  return useQuery({
    queryKey: ['game-challenges'],
    queryFn: fetchActiveChallenges,
    staleTime: 30_000,
    enabled,
  });
}

// ── Slice 3: Vitrina de insignias (jugador) ──

async function fetchUserBadges(): Promise<UserBadgesResult> {
  const res = await fetch('/api/game/badges');
  if (!res.ok) throw new Error('Error cargando las insignias');
  return res.json();
}

export function useUserBadges(enabled = true) {
  return useQuery({
    queryKey: ['game-badges'],
    queryFn: fetchUserBadges,
    staleTime: 30_000,
    enabled,
  });
}

// ── Slice 4: Caso de la Semana (jugador) ──

async function fetchWeeklyCase(): Promise<WeeklyCaseResult> {
  const res = await fetch('/api/game/weekly-case');
  if (!res.ok) throw new Error('Error cargando el caso de la semana');
  return res.json();
}

export function useWeeklyCase(enabled = true) {
  return useQuery({
    queryKey: ['game-weekly-case'],
    queryFn: fetchWeeklyCase,
    staleTime: 60_000,
    enabled,
  });
}

async function fetchWeeklyCaseHistory(): Promise<WeeklyCaseHistoryResult> {
  const res = await fetch('/api/game/weekly-case/history');
  if (!res.ok) throw new Error('Error cargando el historial de casos');
  return res.json();
}

export function useWeeklyCaseHistory(enabled = true) {
  return useQuery({
    queryKey: ['game-weekly-case-history'],
    queryFn: fetchWeeklyCaseHistory,
    staleTime: 60_000,
    enabled,
  });
}

async function fetchWeeklyCaseDetail(caseId: string): Promise<WeeklyCaseResult> {
  const res = await fetch(`/api/game/weekly-case/history?case=${encodeURIComponent(caseId)}`);
  if (!res.ok) throw new Error('Error cargando el caso');
  return res.json();
}

export function useWeeklyCaseDetail(caseId: string | null) {
  return useQuery({
    queryKey: ['game-weekly-case-detail', caseId],
    queryFn: () => fetchWeeklyCaseDetail(caseId as string),
    staleTime: 60_000,
    enabled: !!caseId,
  });
}

export function useSubmitWeeklyCaseAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: WeeklyCaseAnswerPayload
    ): Promise<SubmitWeeklyCaseAnswerResult> => {
      const res = await fetch('/api/game/weekly-case/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error enviando la respuesta');
      return json as SubmitWeeklyCaseAnswerResult;
    },
    onSuccess: () => {
      // Participation may award points/streak/challenges/badges.
      return Promise.all([
        qc.invalidateQueries({ queryKey: ['game-weekly-case'] }),
        qc.invalidateQueries({ queryKey: ['game-weekly-case-history'] }),
        qc.invalidateQueries({ queryKey: ['game-profile'] }),
        qc.invalidateQueries({ queryKey: ['game-ranking'] }),
        qc.invalidateQueries({ queryKey: ['game-challenges'] }),
        qc.invalidateQueries({ queryKey: ['game-badges'] }),
      ]);
    },
  });
}
