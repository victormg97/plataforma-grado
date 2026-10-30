import { z } from 'zod';

/**
 * Presentation config of quiz subjects and categories (admin "Cuestionarios"
 * tab). Icon/color keys are stable string ids stored in the DB; the UI maps
 * them to lucide icons and CSS tone variables. Unknown/null keys fall back to
 * the defaults (BookOpen for subjects, Layers for categories, game accent).
 */

export const QUIZ_ICON_KEYS = [
  'book-open', 'scale', 'gavel', 'landmark', 'scroll', 'file-text', 'library', 'graduation',
  'briefcase', 'building', 'factory', 'users', 'house', 'heart-handshake', 'handshake', 'baby',
  'shield', 'lock', 'siren', 'stamp', 'coins', 'banknote', 'receipt', 'calculator',
  'globe', 'compass', 'ship', 'plane', 'car', 'anchor', 'leaf', 'hammer',
  'brain', 'lightbulb', 'puzzle', 'target', 'layers', 'trophy', 'star', 'crown',
  'flag', 'feather', 'swords', 'sparkles',
] as const;
export type QuizIconKey = (typeof QUIZ_ICON_KEYS)[number];

export const QUIZ_COLOR_KEYS = [
  'burgundy', 'crimson', 'rose', 'amber', 'gold', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate',
] as const;
export type QuizColorKey = (typeof QUIZ_COLOR_KEYS)[number];

export function isQuizIconKey(v: unknown): v is QuizIconKey {
  return typeof v === 'string' && (QUIZ_ICON_KEYS as readonly string[]).includes(v);
}
export function isQuizColorKey(v: unknown): v is QuizColorKey {
  return typeof v === 'string' && (QUIZ_COLOR_KEYS as readonly string[]).includes(v);
}

// ─── Custom icon images ────────────────────────────────────────────────────────

export const QUIZ_ICON_IMAGE_MIME = ['image/png', 'image/webp', 'image/svg+xml'] as const;
export const QUIZ_ICON_IMAGE_EXT = ['.png', '.webp', '.svg'] as const;
export const QUIZ_ICON_IMAGE_MAX_BYTES = 1024 * 1024; // 1 MB
export const QUIZ_ICON_BUCKET = 'game-quiz-icons';

export function isQuizIconImageMime(mime: string): boolean {
  return (QUIZ_ICON_IMAGE_MIME as readonly string[]).includes(mime);
}

// ─── Save payloads ─────────────────────────────────────────────────────────────

/** Partial update: only the keys present are changed. null = back to default. */
export const quizItemPatchSchema = z
  .object({
    icon_key: z.enum(QUIZ_ICON_KEYS).nullable().optional(),
    icon_image_path: z
      .string()
      .max(300)
      .regex(/^[\w-]+\/[\w-]+\.(png|webp|svg)$/, 'INVALID_PATH')
      .nullable()
      .optional(),
    color_key: z.enum(QUIZ_COLOR_KEYS).nullable().optional(),
    description: z.string().trim().max(140, 'TOO_LONG').nullable().optional(),
    is_hidden: z.boolean().optional(),
    quiz_question_count: z.number().int().min(1, 'RANGO_INVALIDO').max(100, 'RANGO_INVALIDO').nullable().optional(),
  })
  .strict();
export type QuizItemPatch = z.infer<typeof quizItemPatchSchema>;

export const quizItemSaveSchema = z.object({
  subject_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  patch: quizItemPatchSchema,
});
export type QuizItemSavePayload = z.infer<typeof quizItemSaveSchema>;

export const quizReorderSchema = z.object({
  subject_id: z.string().uuid().nullable().optional(),
  ids: z.array(z.string().uuid()).min(1).max(500),
});
export type QuizReorderPayload = z.infer<typeof quizReorderSchema>;

// ─── Shapes (admin_get_quiz_config) ────────────────────────────────────────────

export interface QuizDisplaySettings {
  icon_key: string | null;
  icon_image_path: string | null;
  color_key: string | null;
  description: string | null;
  is_hidden: boolean;
  sort_order: number | null;
}

export interface AdminQuizCategoryConfig {
  id: string;
  name: string;
  /** Playable (active, not open-ended) questions of this category in the subject. */
  question_count: number;
  /** Every question of this category in the subject (any status/type). */
  total_question_count?: number;
  settings: QuizDisplaySettings;
}

export interface AdminQuizSubjectConfig {
  id: string;
  name: string;
  question_count: number;
  total_question_count?: number;
  settings: QuizDisplaySettings & { quiz_question_count: number | null };
  categories: AdminQuizCategoryConfig[];
}

// ─── Catalog management (create / rename / delete subjects & categories) ─────

const catalogName = z.string().trim().min(1, 'NAME_REQUIRED').max(120, 'NAME_TOO_LONG');

export const quizCatalogSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_subject'), name: catalogName }),
  z.object({ action: z.literal('rename_subject'), subject_id: z.string().uuid(), name: catalogName }),
  z.object({ action: z.literal('delete_subject'), subject_id: z.string().uuid() }),
  z.object({
    action: z.literal('add_category'),
    subject_id: z.string().uuid(),
    category_id: z.string().uuid().optional(),
    name: catalogName.optional(),
  }),
  z.object({ action: z.literal('rename_category'), category_id: z.string().uuid(), name: catalogName }),
  z.object({
    action: z.literal('remove_category'),
    subject_id: z.string().uuid(),
    category_id: z.string().uuid(),
  }),
]);
export type QuizCatalogPayload = z.infer<typeof quizCatalogSchema>;
