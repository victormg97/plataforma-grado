import { z } from 'zod';

export const horarioSchema = z.object({
  alumno_id: z.string().uuid('Selecciona un alumno'),
  titulo: z.string().min(3, 'El título debe tener al menos 3 caracteres').max(100),
  descripcion: z.string().max(500).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
}).refine(data => data.hora_fin > data.hora_inicio, {
  message: 'La hora de fin debe ser posterior a la hora de inicio',
  path: ['hora_fin'],
});

export type HorarioFormData = z.infer<typeof horarioSchema>;
