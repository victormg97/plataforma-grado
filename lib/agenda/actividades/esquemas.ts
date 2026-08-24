/**
 * Slice `actividades` — esquemas de creación y edición (Requisitos 4.1, 4.6,
 * 10.10, 10.12, 11.2).
 *
 * La unión discriminada por `alcance` convierte el Requisito 4.6 en un error de
 * esquema (400) y no en una comprobación imperativa dentro del servicio.
 *
 * Los campos compuestos vienen de `nucleo` y de `conexion`. El campo `creador_id`
 * **no existe**: el servicio lo toma de la sesión del servidor (Requisito 14.12).
 *
 * Los mensajes de error en los `refine` y `superRefine` son `CodigoErrorAgenda`,
 * para que `desdeZod` los convierta directamente sin mapa de respaldo.
 */
import { z } from 'zod';

import {
  tituloAgenda,
  fechaAgenda,
  horaAgenda,
  categoriaAgenda,
  visibilidadAgenda,
  lugarAgenda,
  descripcionAgenda,
  notaAgenda,
} from '@/lib/agenda/nucleo';

import { enlaceConexionSchema } from '@/lib/agenda/conexion';

// ─── Base compartida por ambas variantes ────────────────────────────────────

const baseActividad = z.object({
  titulo: tituloAgenda,
  fecha: fechaAgenda,
  hora_inicio: horaAgenda.optional(),
  hora_fin: horaAgenda.optional(),
  dia_completo: z.boolean().default(false),
  categoria: categoriaAgenda,
  visibilidad: visibilidadAgenda,
  descripcion: descripcionAgenda,
  nota: notaAgenda,
  lugar: lugarAgenda,
  enlace_conexion: enlaceConexionSchema,
});

// ─── Esquema de creación ────────────────────────────────────────────────────

/**
 * Esquema de creación de una Actividad.
 *
 * - `alcance: 'alumnos_seleccionados'`: entre 1 y 200 destinatarios (Requisito 4.1).
 *   Los repetidos se colapsan con `new Set` antes de validar el tamaño.
 * - `alcance: 'todos_alumnos'`: sin destinatarios explícitos (Requisito 4.6).
 *   El campo `destinatarios` no se acepta o debe estar vacío.
 * - `superRefine`: sin día completo las horas son obligatorias (Requisito 10.10) y
 *   `hora_fin > hora_inicio` (rango válido, Requisito 10.12).
 */
export const crearActividadSchema = z
  .discriminatedUnion('alcance', [
    baseActividad.extend({
      alcance: z.literal('alumnos_seleccionados'),
      destinatarios: z
        .array(z.string().uuid())
        .transform((ids) => [...new Set(ids)])
        .refine((ids) => ids.length >= 1 && ids.length <= 200, {
          message: 'destinatarios_invalidos',
        }),
    }),
    baseActividad.extend({
      alcance: z.literal('todos_alumnos'),
      destinatarios: z
        .array(z.string().uuid())
        .max(0, { message: 'alcance_sin_destinatarios' })
        .optional(),
    }),
  ])
  .superRefine((val, ctx) => {
    // Requisito 10.10: sin día completo, las dos horas son obligatorias
    if (!val.dia_completo) {
      if (val.hora_inicio === undefined || val.hora_fin === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'horas_requeridas',
          path: ['hora_inicio'],
        });
        return;
      }

      // Requisito 10.12 / 1.6: hora_fin > hora_inicio
      if (val.hora_fin <= val.hora_inicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rango_invalido',
          path: ['hora_fin'],
        });
      }
    }
  });

/**
 * Esquema de edición de una Actividad.
 *
 * Se reenvía siempre el formulario completo (no parcial): el diseño dicta que
 * `editarActividadSchema = crearActividadSchema`.
 */
export const editarActividadSchema = crearActividadSchema;

// ─── Tipos inferidos ────────────────────────────────────────────────────────

/** Entrada validada para la creación. */
export type CrearActividad = z.infer<typeof crearActividadSchema>;

/** Entrada validada para la edición. */
export type EditarActividad = z.infer<typeof editarActividadSchema>;
