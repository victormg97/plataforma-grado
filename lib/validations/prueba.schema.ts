import { z } from 'zod';

export const calificarPruebaSchema = z.object({
  nota: z
    .number()
    .min(1.0, 'La nota mínima es 1.0')
    .max(7.0, 'La nota máxima es 7.0')
    .multipleOf(0.1)
    .optional()
    .nullable(),
  observaciones: z.string().optional().nullable(),
});

export type CalificarPruebaData = z.infer<typeof calificarPruebaSchema>;
