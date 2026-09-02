import { z } from 'zod';

/**
 * Shared contracts for the new configurable systems: hero image, levels,
 * lives, recent achievements, and player moderation. Server-side validated;
 * RPCs re-validate role and business rules. Error messages are UPPER_SNAKE
 * codes the UI maps to i18n strings.
 */

// ─── Hero image (game home) ───────────────────────────────────────────────────

// Formats with transparency support. Fits the hero space (no square rule).
export const HERO_IMAGE_ACCEPTED_MIME = ['image/png', 'image/webp', 'image/svg+xml'] as const;
export const HERO_IMAGE_ACCEPTED_EXT = ['.png', '.webp', '.svg'] as const;
export const HERO_IMAGE_MAX_BYTES = 3 * 1024 * 1024; // 3 MB

export function isHeroImageMime(mime: string): boolean {
  return (HERO_IMAGE_ACCEPTED_MIME as readonly string[]).includes(mime);
}

// ─── Level thresholds CRUD ─────────────────────────────────────────────────────

export const levelThresholdSchema = z.object({
  id: z.string().uuid().optional(),
  level: z.number().int().positive('RANGO_INVALIDO'),
  min_points: z.number().int().nonnegative('RANGO_INVALIDO'),
  label: z.string().trim().max(60).nullable().optional(),
});
export type LevelThresholdPayload = z.infer<typeof levelThresholdSchema>;

// Full replacement of the tenant's level table (like streak thresholds).
export const levelThresholdsSchema = z.object({
  levels: z.array(levelThresholdSchema).min(1, 'AL_MENOS_UNO'),
});
export type LevelThresholdsPayload = z.infer<typeof levelThresholdsSchema>;

// ─── Lives config (subset of game_settings, edited in the Lives tab) ───────────

export const livesConfigSchema = z.object({
  lives_enabled: z.boolean(),
  lives_max: z.number().int().positive('RANGO_INVALIDO'),
  lives_start: z.number().int().nonnegative('RANGO_INVALIDO'),
  lives_block_when_empty: z.boolean(),
  lives_regen_mode: z.enum(['per_life', 'full_refill']),
  lives_regen_hours: z.number().positive('RANGO_INVALIDO'),
});
export type LivesConfigPayload = z.infer<typeof livesConfigSchema>;

// ─── Player moderation actions ─────────────────────────────────────────────────

export const playerActionSchema = z.object({
  user_id: z.string().uuid(),
});
export type PlayerActionPayload = z.infer<typeof playerActionSchema>;

export const banPlayerSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().trim().max(500).nullable().optional(),
});
export type BanPlayerPayload = z.infer<typeof banPlayerSchema>;

export const setPlayerLivesSchema = z.object({
  user_id: z.string().uuid(),
  lives: z.number().int().nonnegative('RANGO_INVALIDO'),
});
export type SetPlayerLivesPayload = z.infer<typeof setPlayerLivesSchema>;

// ─── Response shapes ───────────────────────────────────────────────────────────

export interface PlayerLevel {
  level: number;
  xp: number;
  current_min: number;
  next_min: number | null;
}

export interface PlayerLives {
  enabled: boolean;
  current: number | null;
  max: number;
  next_regen: string | null;
  block_when_empty: boolean;
}

export interface PlayerModeration {
  is_restricted: boolean;
  is_banned: boolean;
  ban_reason: string | null;
}

export interface RecentAchievement {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  granted_at: string;
}

/** Result of get_game_profile. */
export interface GameProfileResult {
  nickname: string | null;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  nickname_updated_at: string | null;
  lives: PlayerLives;
  level: PlayerLevel;
  moderation: PlayerModeration;
  recent_achievements: RecentAchievement[];
}

/** One row of list_game_players (admin). */
export interface GamePlayer {
  user_id: string;
  nickname: string | null;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  rol: string;
  current_streak: number | null;
  level: number;
  xp: number;
  current_lives: number | null;
  is_restricted: boolean;
  is_banned: boolean;
  ban_reason: string | null;
}
