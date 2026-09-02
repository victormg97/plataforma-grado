import { z } from 'zod';

/**
 * Shared contracts for the Slice 3 admin panel mutations. Kept server-side
 * validated; the RPCs re-validate role and business rules.
 */

// ─── Score reset (danger zone) ────────────────────────────────────────────────

export const scoreResetSchema = z.object({
  scope: z.enum(['current-month-ranking-only', 'full-history-archive']),
  confirmation: z.string().min(1),
});
export type ScoreResetPayload = z.infer<typeof scoreResetSchema>;

// ─── Challenge CRUD ───────────────────────────────────────────────────────────

export const challengeCriteriaSchema = z.object({
  action_type: z.enum([
    'quiz_completed',
    'daily_question_answered',
    'interrogacion_completed',
    'weekly_case_participated',
    'study_hours_logged',
  ]),
  count: z.number().int().positive(),
  category: z.string().uuid().nullable().optional(),
});

export const challengeSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'TITULO_REQUERIDO').max(200),
    description: z.string().trim().max(2000).nullable().optional(),
    criteria: challengeCriteriaSchema,
    period_type: z.enum(['weekly', 'monthly', 'custom']),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
    enabled: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    // custom period requires an explicit window (Req. 14.4).
    if (val.period_type === 'custom') {
      if (!val.starts_at || !val.ends_at) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['starts_at'], message: 'CUSTOM_WINDOW_REQUIRED' });
      } else if (new Date(val.ends_at) <= new Date(val.starts_at)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ends_at'], message: 'END_AFTER_START' });
      }
    }
  });
export type ChallengePayload = z.infer<typeof challengeSchema>;

// ─── Point sources ────────────────────────────────────────────────────────────

export const pointSourceSchema = z.object({
  action_type: z.enum([
    'quiz_completed',
    'daily_question_answered',
    'interrogacion_completed',
    'weekly_case_participated',
    'study_hours_logged',
  ]),
  points_value: z.number().int().min(0, 'RANGO_INVALIDO'),
  enabled: z.boolean(),
  counts_for_streak: z.boolean(),
});
export type PointSourcePayload = z.infer<typeof pointSourceSchema>;

// ─── Streak thresholds ────────────────────────────────────────────────────────

export const streakThresholdsSchema = z.object({
  days: z.array(z.number().int().positive('RANGO_INVALIDO')),
});
export type StreakThresholdsPayload = z.infer<typeof streakThresholdsSchema>;

// ─── Daily question curation ──────────────────────────────────────────────────

export const dailyCurateSchema = z.object({
  question_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'FECHA_INVALIDA'),
  question_id: z.string().uuid(),
});
export type DailyCuratePayload = z.infer<typeof dailyCurateSchema>;

// ─── Quiz subject count override ──────────────────────────────────────────────

export const quizSubjectSettingSchema = z.object({
  subject_id: z.string().uuid(),
  quiz_question_count: z.number().int().positive('RANGO_INVALIDO'),
});
export type QuizSubjectSettingPayload = z.infer<typeof quizSubjectSettingSchema>;

// ─── Stats result shape (from get_game_stats) ──────────────────────────────────

export interface GameStats {
  active_users: { daily: number; weekly: number; monthly: number };
  daily_question: { respondents: number; eligible: number; rate: number };
  quizzes_completed: number;
  streak_distribution: {
    none: number;
    from_1_2: number;
    from_3_6: number;
    from_7_14: number;
    from_15_29: number;
    from_30: number;
  };
  ranking_preview: { position: number; user_id: string; display_name: string; points: number }[];
  badges_most_unlocked: { badge_id: string; name: string; count: number }[];
  badges_least_unlocked: { badge_id: string; name: string; count: number }[];
}

export interface ScoreResetLogEntry {
  id: string;
  executed_by: string;
  executed_at: string;
  reset_scope: 'current-month-ranking-only' | 'full-history-archive';
}
