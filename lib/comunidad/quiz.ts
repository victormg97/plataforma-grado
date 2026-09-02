import { z } from 'zod';

/**
 * Shared contracts for the Slice 2 quiz flow. Mirrors the answer payload of
 * the Pregunta del Día (lib/comunidad/answer.ts) but per-question, so a single
 * submit endpoint can carry a full quiz.
 *
 * Must stay in sync with start_quiz() / submit_quiz() (migration 122/124):
 *   - single_choice / multiple_choice : { question_id, selected: number[] }
 *   - true_false                      : { question_id, value: boolean }
 *
 * The RPC re-evaluates correctness server-side; the client only sends its
 * selection. Correctness is never trusted from the client.
 */

// ─── Quiz submit payload ──────────────────────────────────────────────────────

export const quizChoiceAnswerSchema = z.object({
  question_id: z.string().uuid(),
  selected: z.array(z.number().int().min(0)).min(1, 'SELECT_ONE'),
});

export const quizTrueFalseAnswerSchema = z.object({
  question_id: z.string().uuid(),
  value: z.boolean(),
});

export const quizAnswerSchema = z.union([quizChoiceAnswerSchema, quizTrueFalseAnswerSchema]);

export const quizSubmitSchema = z.object({
  subject_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  answers: z.array(quizAnswerSchema).min(1, 'NO_ANSWERS'),
});

export const quizStartSchema = z.object({
  subject_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
});

export type QuizAnswer = z.infer<typeof quizAnswerSchema>;
export type QuizSubmitPayload = z.infer<typeof quizSubmitSchema>;
export type QuizStartPayload = z.infer<typeof quizStartSchema>;

// ─── Quiz question / result shapes (from start_quiz / submit_quiz) ─────────────

export type QuizQuestionType = 'single_choice' | 'multiple_choice' | 'true_false';

export interface QuizQuestionOption {
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  content: string;
  /** Array for choice types; empty object for true_false. Correctness omitted. */
  options: QuizQuestionOption[] | Record<string, never>;
}

export interface QuizStartResult {
  ok: boolean;
  error_code?: string;
  subject_id?: string;
  category_id?: string | null;
  question_count?: number;
  questions?: QuizQuestion[];
}

export interface CompletedChallenge {
  challenge_id: string;
  title: string;
}

export interface QuizSubmitResult {
  ok: boolean;
  error_code?: string;
  aciertos: number;
  total_presented: number;
  points_awarded: number;
  scoring_mode: 'fixed' | 'proportional';
  completed_challenges: CompletedChallenge[];
}

// ─── Ranking shapes (from get_monthly_ranking + get_my_ranking_position) ───────

export interface RankingEntry {
  position: number;
  user_id: string;
  points: number;
  /** Real name when show_real_name is on; otherwise null. */
  display_name: string | null;
  nickname: string | null;
}

export interface MyRankingPosition {
  has_position: boolean;
  position?: number;
  points?: number;
}

export interface MonthlyRankingResult {
  month: string; // 'YYYY-MM'
  total_entries: number;
  limit: number;
  offset: number;
  entries: RankingEntry[];
  my_position?: MyRankingPosition;
}

// ─── Challenge shapes (from get_active_challenges) ─────────────────────────────

export interface ActiveChallenge {
  id: string;
  title: string;
  description: string | null;
  period_type: 'weekly' | 'monthly' | 'custom';
  target_count: number;
  progress_count: number;
  completed: boolean;
}

export interface ActiveChallengesResult {
  challenges: ActiveChallenge[];
}

// ─── Quiz subjects (from /quiz/subjects) ───────────────────────────────────────

export interface QuizSubject {
  id: string;
  name: string;
  active_question_count: number;
  effective_question_count: number;
}

// ─── Quiz categories (from /quiz/categories) ───────────────────────────────────

export interface QuizCategory {
  id: string;
  name: string;
  active_question_count: number;
}

export interface QuizCategoriesResult {
  categories: QuizCategory[];
}
