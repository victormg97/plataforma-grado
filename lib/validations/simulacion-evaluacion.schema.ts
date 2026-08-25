import { z } from 'zod';

export const simulacionEvaluacionSchema = z.object({
  nota: z.number().min(1).max(7).nullable(),
  feedback: z.string().max(2000).nullable().optional(),
  estado: z.enum(['calificada', 'pendiente']),
});

export type SimulacionEvaluacionInput = z.infer<typeof simulacionEvaluacionSchema>;
