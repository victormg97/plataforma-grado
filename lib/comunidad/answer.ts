import { z } from 'zod';

/**
 * Shared answer payload contract for the Pregunta del Día.
 *
 * Must stay in sync with answer_daily_question() (migration 121):
 *   - single_choice / multiple_choice : { selected: number[] } (option indices)
 *   - true_false                      : { value: boolean }
 *
 * The RPC evaluates correctness server-side; the client only sends the
 * selection. The union accepts either shape so a single endpoint can handle
 * every daily-question type.
 */

export const choiceAnswerSchema = z.object({
  selected: z.array(z.number().int().min(0)).min(1, 'SELECT_ONE'),
});

export const trueFalseAnswerSchema = z.object({
  value: z.boolean(),
});

/** Accepts either the choice payload or the true/false payload. */
export const dailyAnswerSchema = z.union([choiceAnswerSchema, trueFalseAnswerSchema]);

export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;
export type TrueFalseAnswer = z.infer<typeof trueFalseAnswerSchema>;
export type DailyAnswer = z.infer<typeof dailyAnswerSchema>;

/** Result returned by answer_daily_question, surfaced to the UI. */
export interface DailyAnswerResult {
  ok: boolean;
  already_answered: boolean;
  is_correct: boolean;
  explanation: string | null;
  points_awarded: number;
  current_streak: number;
  longest_streak: number;
  error_code?: string;
}
