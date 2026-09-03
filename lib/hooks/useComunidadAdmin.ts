'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminBadge, BadgePayload, BadgeGrantPayload } from '@/lib/comunidad/badge';
import type {
  ChallengePayload,
  PointSourcePayload,
  StreakThresholdsPayload,
  DailyCuratePayload,
  QuizSubjectSettingPayload,
  ScoreResetPayload,
  GameStats,
  ScoreResetLogEntry,
} from '@/lib/comunidad/admin';
import type {
  GamePointSource,
  GameStreakThreshold,
  GameChallenge,
  GameDailyQuestion,
  GameWeeklyCase,
  GameLevelThreshold,
} from '@/lib/supabase/types';
import type { WeeklyCasePayload, WeeklyCaseResolutionPayload } from '@/lib/comunidad/weekly-case';
import type {
  LevelThresholdsPayload,
  GamePlayer,
  BanPlayerPayload,
  SetPlayerLivesPayload,
} from '@/lib/comunidad/game-config';

/**
 * Admin-only React Query hooks for the Comunidad Estratégica admin panel
 * (dedicated route /admin/comunidad). All requests hit /api/game/admin/**,
 * which validate the admin role server-side.
 */

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error ?? 'ERROR') as Error & { payload?: unknown };
    err.payload = json;
    throw err;
  }
  return json as T;
}

// ─── General settings ───────────────────────────────────────────────────────

export function useUpdateGameSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      jsonFetch('/api/game/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-settings'] }),
  });
}

// ─── Badges ────────────────────────────────────────────────────────────────

export function useAdminBadges() {
  return useQuery({
    queryKey: ['game-admin-badges'],
    queryFn: () => jsonFetch<AdminBadge[]>('/api/game/admin/badges'),
    staleTime: 30_000,
  });
}

function invalidateBadges(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['game-admin-badges'] }),
    qc.invalidateQueries({ queryKey: ['game-badges'] }),
  ]);
}

export function useCreateBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BadgePayload) =>
      jsonFetch<AdminBadge>('/api/game/admin/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateBadges(qc),
  });
}

export function useUpdateBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BadgePayload & { id: string }) =>
      jsonFetch<AdminBadge>('/api/game/admin/badges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateBadges(qc),
  });
}

export function useDeleteBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      jsonFetch<{ ok: boolean; deleted?: string; affected_count?: number }>(
        `/api/game/admin/badges?id=${id}${force ? '&force=true' : ''}`,
        { method: 'DELETE' }
      ),
    onSuccess: () => invalidateBadges(qc),
  });
}

export function useUploadBadgeImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return jsonFetch<{ image_path: string; public_url: string; warning: string | null }>(
        '/api/game/admin/badges/image',
        { method: 'POST', body: form }
      );
    },
  });
}

export function useGrantBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BadgeGrantPayload) =>
      jsonFetch<{ ok: boolean }>('/api/game/admin/badges/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateBadges(qc),
  });
}

// ─── Point sources ────────────────────────────────────────────────────────

export function useAdminPointSources() {
  return useQuery({
    queryKey: ['game-admin-point-sources'],
    queryFn: () => jsonFetch<GamePointSource[]>('/api/game/admin/point-sources'),
    staleTime: 60_000,
  });
}

export function useUpdatePointSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PointSourcePayload) =>
      jsonFetch<GamePointSource>('/api/game/admin/point-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-admin-point-sources'] }),
  });
}

// ─── Streak thresholds ──────────────────────────────────────────────────────

export function useStreakThresholds() {
  return useQuery({
    queryKey: ['game-admin-streak-thresholds'],
    queryFn: () => jsonFetch<GameStreakThreshold[]>('/api/game/admin/streak-thresholds'),
    staleTime: 60_000,
  });
}

export function useUpdateStreakThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StreakThresholdsPayload) =>
      jsonFetch<GameStreakThreshold[]>('/api/game/admin/streak-thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-admin-streak-thresholds'] }),
  });
}

// ─── Daily question curation ─────────────────────────────────────────────────

/** A curated daily-question row enriched with the resolved question content. */
export interface AdminDailyQuestionRow extends GameDailyQuestion {
  question_content: string | null;
  question_type: string | null;
  subject_name: string | null;
}

export function useAdminDailyQuestions() {
  return useQuery({
    queryKey: ['game-admin-daily-questions'],
    queryFn: () => jsonFetch<AdminDailyQuestionRow[]>('/api/game/admin/daily-question'),
    staleTime: 30_000,
  });
}

export function useCurateDailyQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DailyCuratePayload) =>
      jsonFetch<GameDailyQuestion>('/api/game/admin/daily-question', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-admin-daily-questions'] }),
  });
}

// ─── Challenges CRUD ──────────────────────────────────────────────────────────

export function useAdminChallenges() {
  return useQuery({
    queryKey: ['game-admin-challenges'],
    queryFn: () => jsonFetch<GameChallenge[]>('/api/game/admin/challenges'),
    staleTime: 30_000,
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChallengePayload) =>
      jsonFetch<GameChallenge>('/api/game/admin/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-admin-challenges'] }),
  });
}

export function useUpdateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChallengePayload & { id: string }) =>
      jsonFetch<GameChallenge>('/api/game/admin/challenges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-admin-challenges'] }),
  });
}

export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean }>(`/api/game/admin/challenges?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-admin-challenges'] }),
  });
}

// ─── Quiz subject overrides ────────────────────────────────────────────────

export interface AdminQuizSubject {
  subject_id: string;
  name: string;
  quiz_question_count: number | null;
}

export function useAdminQuizSubjects() {
  return useQuery({
    queryKey: ['game-admin-quiz-subjects'],
    queryFn: () => jsonFetch<AdminQuizSubject[]>('/api/game/admin/quiz-subjects'),
    staleTime: 60_000,
  });
}

export function useUpdateQuizSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuizSubjectSettingPayload | { subject_id: string; quiz_question_count: null }) =>
      jsonFetch('/api/game/admin/quiz-subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-admin-quiz-subjects'] }),
  });
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export function useGameStats() {
  return useQuery({
    queryKey: ['game-admin-stats'],
    queryFn: () => jsonFetch<GameStats>('/api/game/admin/stats'),
    staleTime: 60_000,
  });
}

// ─── Score reset (danger zone) ───────────────────────────────────────────────

export function useScoreResetLog() {
  return useQuery({
    queryKey: ['game-admin-score-reset-log'],
    queryFn: () => jsonFetch<ScoreResetLogEntry[]>('/api/game/admin/score-reset'),
    staleTime: 30_000,
  });
}

export function useScoreReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScoreResetPayload) =>
      jsonFetch<{ ok: boolean; new_period_id: string }>('/api/game/admin/score-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['game-admin-score-reset-log'] }),
        qc.invalidateQueries({ queryKey: ['game-admin-stats'] }),
        qc.invalidateQueries({ queryKey: ['game-ranking'] }),
      ]),
  });
}

// ─── Users (manual grant picker) ─────────────────────────────────────────────

export interface AdminUserOption {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
}

export function useAdminUsers(q: string, rol?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (rol) params.set('rol', rol);
  return useQuery({
    queryKey: ['game-admin-users', q, rol ?? ''],
    queryFn: () => jsonFetch<AdminUserOption[]>(`/api/game/admin/users?${params.toString()}`),
    staleTime: 30_000,
  });
}

// ─── Questions (daily curation picker) ───────────────────────────────────────

export interface AdminQuestionOption {
  id: string;
  content: string;
  type: string;
  subject_id: string | null;
  category_id: string | null;
  subject_name: string | null;
}

export function useAdminQuestions(q: string, subjectId?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (subjectId) params.set('subject_id', subjectId);
  return useQuery({
    queryKey: ['game-admin-questions', q, subjectId ?? ''],
    queryFn: () => jsonFetch<AdminQuestionOption[]>(`/api/game/admin/questions?${params.toString()}`),
    staleTime: 30_000,
  });
}

// ── Paginated question picker (daily-question curation) ──

export interface PickerQuestion {
  id: string;
  content: string;
  type: string;
  difficulty: string | null;
  subject_id: string | null;
  subject_name: string | null;
  category_id: string | null;
  category_name: string | null;
}

export interface QuestionPickerResult {
  data: PickerQuestion[];
  page: number;
  total: number;
  page_size: number;
  total_pages: number;
}

export interface QuestionPickerFilters {
  q?: string;
  subjectId?: string | null;
  categoryId?: string | null;
  type?: string | null;
  page?: number;
  pageSize?: number;
}

export function useQuestionPicker(filters: QuestionPickerFilters) {
  const { q = '', subjectId = null, categoryId = null, type = null, page = 1, pageSize = 10 } = filters;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (subjectId) params.set('subject_id', subjectId);
  if (categoryId) params.set('category_id', categoryId);
  if (type) params.set('type', type);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return useQuery({
    queryKey: ['game-admin-question-picker', q, subjectId ?? '', categoryId ?? '', type ?? '', page, pageSize],
    queryFn: () => jsonFetch<QuestionPickerResult>(`/api/game/admin/question-picker?${params.toString()}`),
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous page visible while paginating
  });
}

// ── Question-bank filter options (subjects + categories) ──

export interface QbFilterOption {
  id: string;
  name: string;
}

export function useQbSubjects() {
  return useQuery({
    queryKey: ['qb-subjects-filter'],
    queryFn: () => jsonFetch<QbFilterOption[]>('/api/question-bank/subjects'),
    staleTime: 5 * 60_000,
  });
}

export function useQbCategories() {
  return useQuery({
    queryKey: ['qb-categories-filter'],
    queryFn: () => jsonFetch<QbFilterOption[]>('/api/question-bank/categories'),
    staleTime: 5 * 60_000,
  });
}

// ─── Weekly cases (Slice 4) ──────────────────────────────────────────────────

function invalidateWeeklyCases(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['game-admin-weekly-cases'] }),
    qc.invalidateQueries({ queryKey: ['game-weekly-case'] }),
    qc.invalidateQueries({ queryKey: ['game-weekly-case-history'] }),
  ]);
}

export function useAdminWeeklyCases() {
  return useQuery({
    queryKey: ['game-admin-weekly-cases'],
    queryFn: () => jsonFetch<GameWeeklyCase[]>('/api/game/admin/weekly-cases'),
    staleTime: 30_000,
  });
}

export function useCreateWeeklyCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WeeklyCasePayload) =>
      jsonFetch<GameWeeklyCase>('/api/game/admin/weekly-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateWeeklyCases(qc),
  });
}

export function useUpdateWeeklyCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WeeklyCasePayload & { id: string }) =>
      jsonFetch<GameWeeklyCase>('/api/game/admin/weekly-cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateWeeklyCases(qc),
  });
}

export function useDeleteWeeklyCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      jsonFetch<{ ok: boolean }>(`/api/game/admin/weekly-cases?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateWeeklyCases(qc),
  });
}

export function usePublishResolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WeeklyCaseResolutionPayload) =>
      jsonFetch<{ ok: boolean }>('/api/game/admin/weekly-cases/resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidateWeeklyCases(qc),
  });
}

// ─── Level thresholds ────────────────────────────────────────────────────────

export function useAdminLevels() {
  return useQuery({
    queryKey: ['game-admin-levels'],
    queryFn: () => jsonFetch<GameLevelThreshold[]>('/api/game/admin/levels'),
    staleTime: 30_000,
  });
}

export function useUpdateLevels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LevelThresholdsPayload) =>
      jsonFetch<GameLevelThreshold[]>('/api/game/admin/levels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['game-admin-levels'] }),
        qc.invalidateQueries({ queryKey: ['game-admin-players'] }),
        qc.invalidateQueries({ queryKey: ['game-ranking'] }),
      ]),
  });
}

// ─── Hero image ──────────────────────────────────────────────────────────────

export function useUploadHeroImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<{ image_path: string; public_url: string }> => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/game/admin/hero-image', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json.error ?? 'ERROR') as Error & { payload?: unknown };
        err.payload = json;
        throw err;
      }
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-settings'] }),
  });
}

export function useDeleteHeroImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jsonFetch<{ ok: boolean }>('/api/game/admin/hero-image', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-settings'] }),
  });
}

// ─── Players (moderation) ─────────────────────────────────────────────────────

export function useAdminPlayers(q: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  return useQuery({
    queryKey: ['game-admin-players', q],
    queryFn: () => jsonFetch<{ players: GamePlayer[] }>(`/api/game/admin/players?${params.toString()}`),
    staleTime: 15_000,
  });
}

type PlayerAction =
  | { action: 'restrict' | 'unrestrict' | 'unban' | 'reset_level'; user_id: string }
  | ({ action: 'ban' } & BanPlayerPayload)
  | ({ action: 'set_lives' } & SetPlayerLivesPayload);

export function usePlayerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlayerAction) =>
      jsonFetch<{ ok: boolean }>('/api/game/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['game-admin-players'] }),
        qc.invalidateQueries({ queryKey: ['game-ranking'] }),
      ]),
  });
}

// ─── Weekly-case answer review & grading ──────────────────────────────────────

export interface CaseAnswerRow {
  case_id: string;
  user_id: string;
  case_title: string;
  answer_content: string;
  submitted_at: string;
  updated_at: string;
  quality_score: number | null;
  points_awarded: number | null;
  feedback: string | null;
  graded_at: string | null;
  graded: boolean;
  nickname: string | null;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
}

export interface CaseAnswersResult {
  data: CaseAnswerRow[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface CaseAnswersFilters {
  caseId?: string | null;
  userId?: string | null;
  status?: 'pending' | 'graded' | null;
  page?: number;
  pageSize?: number;
}

export function useCaseAnswers(filters: CaseAnswersFilters) {
  const { caseId = null, userId = null, status = null, page = 1, pageSize = 10 } = filters;
  const params = new URLSearchParams();
  if (caseId) params.set('case_id', caseId);
  if (userId) params.set('user_id', userId);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return useQuery({
    queryKey: ['game-admin-case-answers', caseId ?? '', userId ?? '', status ?? '', page, pageSize],
    queryFn: () => jsonFetch<CaseAnswersResult>(`/api/game/admin/case-answers?${params.toString()}`),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export interface CasePendingCounts {
  total: number;
  by_case: Record<string, number>;
  by_user: Record<string, number>;
}

export function useCasePendingCounts() {
  return useQuery({
    queryKey: ['game-admin-case-pending-counts'],
    queryFn: () => jsonFetch<CasePendingCounts>('/api/game/admin/case-answers/counts'),
    staleTime: 30_000,
  });
}

export interface GradeCasePayload {
  case_id: string;
  user_id: string;
  quality_score?: number | null;
  points?: number;
  feedback?: string | null;
}

export function useGradeCaseAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GradeCasePayload) =>
      jsonFetch<{ ok: boolean }>('/api/game/admin/case-answers/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['game-admin-case-answers'] }),
        qc.invalidateQueries({ queryKey: ['game-admin-case-pending-counts'] }),
        qc.invalidateQueries({ queryKey: ['game-ranking'] }),
      ]),
  });
}
