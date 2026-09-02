import { z } from 'zod';

/**
 * Shared nickname (mote) rules for "Comunidad Estratégica".
 *
 * Single source of truth for both the client form and the API route.
 * Must stay in sync with the CHECK constraint in migration 119 and the
 * validation inside the upsert_game_nickname() RPC:
 *   - 3 to 20 characters (after trimming)
 *   - allowed: letters (incl. common Spanish accents + ñ/ü), digits,
 *     hyphen and underscore
 */

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;

/** Allowed character class (mirrors the DB constraint). */
export const NICKNAME_REGEX = /^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ-]{3,20}$/;

/** Trim + lowercase, used for case-insensitive uniqueness. */
export function normalizeNickname(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Zod schema for a nickname submission. Trims first, then validates length
 * and allowed characters. Error messages are localized in the UI layer via
 * error codes; these plain messages are a sensible fallback.
 */
export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, 'MIN_LENGTH')
  .max(NICKNAME_MAX_LENGTH, 'MAX_LENGTH')
  .regex(NICKNAME_REGEX, 'INVALID_CHARS');

export const nicknamePayloadSchema = z.object({
  nickname: nicknameSchema,
});

export type NicknamePayload = z.infer<typeof nicknamePayloadSchema>;

/** Error codes returned by the upsert_game_nickname RPC. */
export type NicknameErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_FORMAT'
  | 'NICKNAME_TAKEN'
  | 'COOLDOWN_ACTIVE';
