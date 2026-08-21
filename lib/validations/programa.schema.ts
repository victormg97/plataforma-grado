import { z } from 'zod';

export const programaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200),
  descripcion: z.string().optional().nullable(),
  profesor_id: z.string().uuid().optional().nullable(), // legacy / backward compat
  // Solo admin puede especificar visibilidad y profesor_ids
  visibilidad: z.enum(['todos', 'especifico']).optional(),
  profesor_ids: z.array(z.string().uuid()).optional(), // IDs de profes cuando visibilidad='especifico'
});

export const claseSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200),
  descripcion: z.string().optional().nullable(),
  tipo: z.enum(['materia', 'prueba']),
  orden: z.number().int().min(1),
  duracion_min: z.number().int().min(15).max(480).optional().nullable(),
});

export const asignarProgramaSchema = z.object({
  alumno_ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos un alumno'),
  horarios_por_alumno: z.array(
    z.object({
      alumno_id: z.string().uuid(),
      clases: z.array(
        z.object({
          clase_id: z.string().uuid(),
          fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
          hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
          hora_fin: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido'),
        })
      ).min(1),
    })
  ).min(1),
});

export type ProgramaFormData = z.infer<typeof programaSchema>;
export type ClaseFormData = z.infer<typeof claseSchema>;
export type AsignarProgramaData = z.infer<typeof asignarProgramaSchema>;
