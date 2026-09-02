import { z } from 'zod';

/**
 * Shared contracts for the Slice 4 "Caso de la Semana". Kept server-side
 * validated; the RPCs re-validate access, role and business rules.
 * Error messages are UPPER_SNAKE codes the UI maps to i18n strings.
 */

// ─── Admin: create / update a weekly case ─────────────────────────────────────

export const weeklyCaseSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'TITULO_REQUERIDO').max(200),
    content: z.string().trim().min(1, 'CONTENIDO_REQUERIDO'),
    window_start: z.string().datetime({ offset: true }),
    window_end: z.string().datetime({ offset: true }),
    // Admin publishes as draft or open; closed/resolved are derived/RPC-driven.
    status: z.enum(['draft', 'open']).default('draft'),
    resolution_visibility: z.enum(['participants_only', 'all_users']).default('participants_only'),
  })
  .superRefine((val, ctx) => {
    // Window end must be after start (Req. 1.4).
    if (new Date(val.window_end) <= new Date(val.window_start)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['window_end'], message: 'WINDOW_END_AFTER_START' });
    }
  });
export type WeeklyCasePayload = z.infer<typeof weeklyCaseSchema>;

// ─── Admin: publish the commented resolution ──────────────────────────────────

export const weeklyCaseResolutionSchema = z.object({
  case_id: z.string().uuid(),
  resolution_content: z.string().trim().min(1, 'EMPTY_RESOLUTION'),
  resolution_visibility: z.enum(['participants_only', 'all_users']),
});
export type WeeklyCaseResolutionPayload = z.infer<typeof weeklyCaseResolutionSchema>;

// ─── Player: submit / edit the answer ─────────────────────────────────────────

export const weeklyCaseAnswerSchema = z.object({
  case_id: z.string().uuid(),
  answer_content: z.string().trim().min(1, 'EMPTY_ANSWER'),
});
export type WeeklyCaseAnswerPayload = z.infer<typeof weeklyCaseAnswerSchema>;

// ─── Response shapes (from the RPCs) ──────────────────────────────────────────

export type WeeklyCaseStatus = 'draft' | 'open' | 'closed' | 'resolved';
export type ResolutionVisibility = 'participants_only' | 'all_users';

export interface WeeklyCaseSummary {
  id: string;
  title: string;
  content: string;
  window_start: string;
  window_end: string;
  status: WeeklyCaseStatus;
  resolution_visibility: ResolutionVisibility;
}

export interface WeeklyCaseMyAnswer {
  answer_content: string;
  submitted_at: string;
  updated_at: string;
}

export interface WeeklyCaseResolution {
  published: boolean;
  visible: boolean;
  locked: boolean;
  content: string | null;
}

/** Result of get_current_weekly_case / get_weekly_case_detail. */
export interface WeeklyCaseResult {
  case: WeeklyCaseSummary | null;
  my_answer?: WeeklyCaseMyAnswer | null;
  resolution?: WeeklyCaseResolution;
}

/** One item in the navigable history (get_weekly_case_history). */
export interface WeeklyCaseHistoryItem {
  id: string;
  title: string;
  window_start: string;
  window_end: string;
  status: WeeklyCaseStatus;
  resolution_published: boolean;
  resolution_visibility: ResolutionVisibility;
  i_answered: boolean;
  resolution_visible: boolean;
}

export interface WeeklyCaseHistoryResult {
  total: number;
  limit: number;
  offset: number;
  items: WeeklyCaseHistoryItem[];
}

/** Result of submit_weekly_case_answer. */
export interface SubmitWeeklyCaseAnswerResult {
  ok: boolean;
  is_new?: boolean;
  points_awarded?: number;
  completed_challenges?: { challenge_id: string; title: string }[];
  error_code?: string;
}
