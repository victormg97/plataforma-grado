/**
 * Slice `entradas-personales` — esquemas de creación y edición (Requisitos 3.3,
 * 3.4, 3.5, 3.9, 4.6, 5.7, 10.10, 14.12).
 *
 * Los dos esquemas se componen desde los fragmentos de `nucleo` y `conexion`:
 * - `nucleo`: título, fecha, horas, categoría, visibilidad, lugar, descripción, nota.
 * - `conexion`: enlace de conexión (URL http/https, max 2 000 chars).
 *
 * **No hay campo `creador_id`**: el servicio lo toma de la sesión del servidor
 * (Requisito 14.12). Aceptarlo del cuerpo de la solicitud sería un defecto de
 * autorización.
 *
 * Los mensajes de error en los `refine` son `CodigoErrorAgenda`, para que `desdeZod`
 * los convierta directamente sin mapa de respaldo.
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

/**
 * Esquema de creación de una Entrada_Personal.
 *
 * - `alcance` solo acepta `'personal'` (Requisito 3.3): esta ruta no puede crear
 *   Actividades. El campo es opcional porque el servicio lo fuerza a `'personal'`
 *   de todos modos.
 * - `destinatarios` debe estar vacío (Requisito 4.6): una Entrada_Personal no
 *   tiene destinatarios.
 * - `refine` 1 (Requisito 5.7): sin día completo, las dos horas son obligatorias.
 * - `refine` 2 (Requisito 3.4): sin día completo, `hora_fin` > `hora_inicio`.
 */
export const crearEntradaPersonalSchema = z
  .object({
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
    alcance: z.literal('personal').optional(),
    destinatarios: z
      .array(z.string().uuid())
      .max(0, { message: 'alcance_sin_destinatarios' })
      .optional(),
  })
  .refine(
    (v) => v.dia_completo || (v.hora_inicio !== undefined && v.hora_fin !== undefined),
    { message: 'horas_requeridas', path: ['hora_inicio'] },
  )
  .refine(
    (v) => v.dia_completo || v.hora_fin! > v.hora_inicio!,
    { message: 'rango_invalido', path: ['hora_fin'] },
  );

/**
 * Esquema de edición de una Entrada_Personal.
 *
 * Se reenvía siempre el formulario completo (no parcial): el diseño dicta que
 * `editarEntradaPersonalSchema = crearEntradaPersonalSchema`.
 */
export const editarEntradaPersonalSchema = crearEntradaPersonalSchema;

// ─── Tipos inferidos ────────────────────────────────────────────────────────

/** Entrada validada para la creación. */
export type CrearEntradaPersonal = z.infer<typeof crearEntradaPersonalSchema>;

/** Entrada validada para la edición. */
export type EditarEntradaPersonal = z.infer<typeof editarEntradaPersonalSchema>;
