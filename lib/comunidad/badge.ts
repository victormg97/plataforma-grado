import { z } from 'zod';

/**
 * Shared contracts for the Slice 3 badge system. Must stay in sync with
 * migration 126 (game_badges / user_badges + RPCs). The criteria is a
 * flexible JSONB object discriminated by `type`; unknown types never grant.
 */

// ─── Criteria (discriminated by type) ─────────────────────────────────────────

export const badgeCriteriaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('streak_reached'), days: z.number().int().positive() }),
  z.object({
    type: z.literal('quiz_completed_count'),
    count: z.number().int().positive(),
    subject: z.string().uuid().nullable().optional(),
    category: z.string().uuid().nullable().optional(),
  }),
  z.object({ type: z.literal('weekly_case_count'), count: z.number().int().positive() }),
  z.object({ type: z.literal('interrogacion_count'), count: z.number().int().positive() }),
  z.object({
    type: z.literal('subject_max_score'),
    subject: z.string().uuid(),
    score: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('challenges_completed'), count: z.number().int().positive() }),
]);

export type BadgeCriteria = z.infer<typeof badgeCriteriaSchema>;
export type BadgeCriteriaType = BadgeCriteria['type'];

export const BADGE_CRITERIA_TYPES: BadgeCriteriaType[] = [
  'streak_reached',
  'quiz_completed_count',
  'weekly_case_count',
  'interrogacion_count',
  'subject_max_score',
  'challenges_completed',
];

// ─── Badge create/update payload ──────────────────────────────────────────────

export const badgeSchema = z
  .object({
    name: z.string().trim().min(1, 'NOMBRE_REQUERIDO').max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    image_path: z.string().nullable().optional(),
    audience: z.array(z.enum(['admin', 'profesor', 'alumno', 'lector'])).default([]),
    unlock_type: z.enum(['automatic', 'manual']),
    criteria: badgeCriteriaSchema.nullable().optional(),
    series_key: z.string().trim().max(60).nullable().optional(),
    series_order: z.number().int().nullable().optional(),
    hide_criteria: z.boolean().default(false),
    enabled: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    // Automatic badges require a criteria (Req. 1.5).
    if (val.unlock_type === 'automatic' && !val.criteria) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criteria'], message: 'CRITERIA_REQUIRED' });
    }
    // A series requires an order (Req. 6.1/6.2).
    if (val.series_key && (val.series_order === null || val.series_order === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['series_order'], message: 'SERIES_ORDER_REQUIRED' });
    }
  });

export type BadgePayload = z.infer<typeof badgeSchema>;

export const badgeGrantSchema = z.object({
  badge_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export type BadgeGrantPayload = z.infer<typeof badgeGrantSchema>;

// ─── Showcase shapes (from get_user_badges) ────────────────────────────────────

export interface UnlockedBadge {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  series_key: string | null;
  series_order: number | null;
  granted_at: string;
  grant_method: 'automatic' | 'manual';
}

export interface LockedBadge {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  series_key: string | null;
  series_order: number | null;
  /** Null when hidden (hide_criteria) or when the badge has no criteria. */
  criteria: BadgeCriteria | null;
  hide_criteria: boolean;
}

export interface UserBadgesResult {
  unlocked: UnlockedBadge[];
  locked: LockedBadge[];
}

// ─── Admin badge row (from /admin/badges GET) ──────────────────────────────────

export interface AdminBadge {
  id: string;
  tenant: string;
  name: string;
  description: string | null;
  image_path: string | null;
  audience: string[];
  unlock_type: 'automatic' | 'manual';
  criteria: BadgeCriteria | null;
  series_key: string | null;
  series_order: number | null;
  hide_criteria: boolean;
  enabled: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** How many users currently hold this badge (for the delete warning). */
  grant_count?: number;
}
