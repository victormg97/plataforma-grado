import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'open_ended', 'fill_blank'] as const;
export const difficulties = ['easy', 'medium', 'hard'] as const;
export const statuses = ['draft', 'active'] as const;

// ─── Option sub-schemas ───────────────────────────────────────────────────────

const choiceOptionSchema = z.object({
  text: z.string().min(1, 'El texto de la opción es requerido'),
  is_correct: z.boolean(),
});

const trueFalseOptionsSchema = z.object({
  correct_answer: z.boolean(),
});

const openEndedOptionsSchema = z.object({
  model_answer: z.string().optional(),
});

const fillBlankOptionsSchema = z.object({
  blanks: z.array(z.object({
    position: z.number().int().min(0),
    accepted_answers: z.array(z.string().min(1)).min(1, 'Al menos una respuesta aceptada'),
  })).min(1, 'Al menos un espacio en blanco'),
});

// ─── Main question schema ─────────────────────────────────────────────────────

export const questionSchema = z.object({
  type: z.enum(questionTypes),
  content: z.string().min(1, 'El texto de la pregunta es requerido'),
  options: z.unknown(), // Validated dynamically based on type
  explanation: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  tag_ids: z.array(z.string().uuid()).optional().default([]),
  difficulty: z.enum(difficulties).default('medium'),
  status: z.enum(statuses).default('draft'),
}).superRefine((data, ctx) => {
  // Validate options based on question type
  switch (data.type) {
    case 'single_choice': {
      const result = z.array(choiceOptionSchema).min(2, 'Mínimo 2 opciones').safeParse(data.options);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Las opciones son inválidas', path: ['options'] });
        return;
      }
      const correctCount = result.data.filter(o => o.is_correct).length;
      if (correctCount !== 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe haber exactamente una opción correcta', path: ['options'] });
      }
      break;
    }
    case 'multiple_choice': {
      const result = z.array(choiceOptionSchema).min(2, 'Mínimo 2 opciones').safeParse(data.options);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Las opciones son inválidas', path: ['options'] });
        return;
      }
      const correctCount = result.data.filter(o => o.is_correct).length;
      if (correctCount < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe haber al menos una opción correcta', path: ['options'] });
      }
      break;
    }
    case 'true_false': {
      const result = trueFalseOptionsSchema.safeParse(data.options);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona la respuesta correcta (Verdadero o Falso)', path: ['options'] });
      }
      break;
    }
    case 'open_ended': {
      const result = openEndedOptionsSchema.safeParse(data.options);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Formato de respuesta modelo inválido', path: ['options'] });
      }
      break;
    }
    case 'fill_blank': {
      const result = fillBlankOptionsSchema.safeParse(data.options);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe definir al menos un espacio en blanco con respuestas válidas', path: ['options'] });
      }
      break;
    }
  }
});

export type QuestionFormData = z.infer<typeof questionSchema>;

// ─── Category schema ──────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  keywords: z.array(z.string()).optional().default([]),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

// ─── Tag schema ───────────────────────────────────────────────────────────────

export const tagSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  keywords: z.array(z.string()).optional().default([]),
});

export type TagFormData = z.infer<typeof tagSchema>;
