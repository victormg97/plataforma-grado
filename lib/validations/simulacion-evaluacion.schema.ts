import { z } from 'zod';

export const simulacionEvaluacionSchema = z.object({
  nota: z.number().min(1).max(7).nullable(),
  feedback: z.string().max(2000).nullable().optional(),
  estado: z.literal('calificada'),
});

export type SimulacionEvaluacionInput = z.infer<typeof simulacionEvaluacionSchema>;
