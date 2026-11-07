/**
 * Validation schemas (Zod v4) of the per-student cedulario tracking (phase 2).
 *
 * Pure TypeScript: no React, no Supabase client. The same schemas run in the
 * browser (react-hook-form resolvers) and in Server Actions.
 *
 * Every message is an i18n key relative to the `cedularios.errores` namespace,
 * never literal text, so forms can translate it with `t('errores.' + message)`.
 * Keys that are also a `CedularioErrorCode` (for example `fecha_futura`) already
 * exist in the error catalog. The remaining keys are listed in
 * `CLAVES_VALIDACION_SEGUIMIENTO` so the `errores.*` block of `messages/*.json`
 * can define them.
 *
 * `nota` and `comentario` are plain-text schemas applied to a single value (use
 * `zodAActionError(error, 'nota')` to name the field). Dates are 'yyyy-MM-dd'
 * and are compared with "today" in the platform time zone at parse time.
 */

import { z } from 'zod';

import { esFechaFutura, hoyEnChile } from '@/lib/cedularios/seguimiento/fechas';
import {
  MAX_ALUMNOS_POR_ASIGNACION,
  MAX_COMENTARIO,
  MAX_NOTA,
  MAX_REPASO_NOTA,
} from '@/lib/cedularios/seguimiento/constants';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Maximum number of classes linked to a subject in one operation. */
export const MAX_CLASES_POR_VINCULO = 100;

// ---------------------------------------------------------------------------
// Error keys (relative to `cedularios.errores`)
// ---------------------------------------------------------------------------

/**
 * Field-specific validation keys of the tracking. `fecha_futura` is also a
 * `CedularioErrorCode`; the others must exist in `cedularios.errores`.
 */
export const CLAVES_VALIDACION_SEGUIMIENTO = [
  'cedulario_invalido',
  'alumnos_requeridos',
  'demasiados_alumnos',
  'alumno_invalido',
  'seleccion_materias_vacia',
  'materia_invalida',
  'asignacion_invalida',
  'progreso_invalido',
  'horario_invalido',
  'clases_requeridas',
  'demasiadas_clases',
  'ids_duplicados',
  'materias_en_conflicto',
  'estado_invalido',
  'fecha_invalida',
  'fecha_futura',
  'nota_muy_larga',
  'comentario_requerido',
  'comentario_muy_largo',
  'repaso_nota_muy_larga',
] as const;

export type ClaveValidacionSeguimiento = (typeof CLAVES_VALIDACION_SEGUIMIENTO)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Any 8-4-4-4-12 hex id (not restricted to RFC versions, so seeded ids are accepted). */
function idUuid(clave: ClaveValidacionSeguimiento) {
  return z.guid({ error: clave });
}

/** Array of unique ids with `min..max` items. */
function listaDeIds(
  clave: ClaveValidacionSeguimiento,
  vacia: ClaveValidacionSeguimiento,
  min: number,
  max: number | null,
  demasiados: ClaveValidacionSeguimiento,
) {
  const base = z.array(idUuid(clave), { error: clave }).min(min, vacia);
  const acotada = max === null ? base : base.max(max, demasiados);
  return acotada.refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
    error: 'ids_duplicados',
  });
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Whether 'yyyy-MM-dd' is a real calendar date (rejects 2025-02-30). */
function esFechaReal(valor: string): boolean {
  if (!FORMATO_FECHA.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

/** Valid 'yyyy-MM-dd' date that is not later than today in the platform time zone. */
function fechaNoFutura() {
  return z
    .string({ error: 'fecha_invalida' })
    .refine(esFechaReal, { error: 'fecha_invalida' })
    .refine((valor) => !esFechaReal(valor) || !esFechaFutura(valor, hoyEnChile()), {
      error: 'fecha_futura',
    });
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/** Subjects of an assignment: every active subject, or a non-empty explicit list. */
const materiasAsignadas = z.union(
  [
    z.literal('todas'),
    listaDeIds('materia_invalida', 'seleccion_materias_vacia', 1, null, 'materia_invalida'),
  ],
  { error: 'seleccion_materias_vacia' },
);

export const asignarSchema = z.object({
  cedularioId: idUuid('cedulario_invalido'),
  alumnoIds: listaDeIds(
    'alumno_invalido',
    'alumnos_requeridos',
    1,
    MAX_ALUMNOS_POR_ASIGNACION,
    'demasiados_alumnos',
  ),
  materias: materiasAsignadas,
});

// ---------------------------------------------------------------------------
// Subset of subjects
// ---------------------------------------------------------------------------

const listaMateriasOpcional = z
  .array(idUuid('materia_invalida'), { error: 'materia_invalida' })
  .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
    error: 'ids_duplicados',
  });

export const subconjuntoSchema = z
  .object({
    asignacionId: idUuid('asignacion_invalida'),
    agregar: listaMateriasOpcional,
    quitar: listaMateriasOpcional,
  })
  .refine(
    (v) => {
      const quitar = new Set(v.quitar.map((id) => id.toLowerCase()));
      return !v.agregar.some((id) => quitar.has(id.toLowerCase()));
    },
    { error: 'materias_en_conflicto', path: ['quitar'] },
  );

// ---------------------------------------------------------------------------
// Coverage of a subject
// ---------------------------------------------------------------------------

export const estadoMateriaSchema = z.object({
  progresoId: idUuid('progreso_invalido'),
  estado: z.enum(['pendiente', 'cubierta'], { error: 'estado_invalido' }),
  fecha: fechaNoFutura().optional(),
});

// ---------------------------------------------------------------------------
// Note, comments and reviews
// ---------------------------------------------------------------------------

/** Plain-text note of 0..2000 characters, typed text kept as is. An empty note is stored as `null`. */
export const notaSchema = z
  .string({ error: 'nota_muy_larga' })
  .max(MAX_NOTA, 'nota_muy_larga')
  .transform((valor): string | null => (valor.trim() === '' ? null : valor));

/** Comment trimmed to 1..1000 characters. */
export const comentarioSchema = z
  .string({ error: 'comentario_requerido' })
  .trim()
  .min(1, 'comentario_requerido')
  .max(MAX_COMENTARIO, 'comentario_muy_largo');

export const repasoSchema = z.object({
  fecha: fechaNoFutura(),
  nota: z.string({ error: 'repaso_nota_muy_larga' }).max(MAX_REPASO_NOTA, 'repaso_nota_muy_larga').optional(),
});

// ---------------------------------------------------------------------------
// Linked classes
// ---------------------------------------------------------------------------

export const vincularClasesSchema = z.object({
  progresoId: idUuid('progreso_invalido'),
  horarioIds: listaDeIds(
    'horario_invalido',
    'clases_requeridas',
    1,
    MAX_CLASES_POR_VINCULO,
    'demasiadas_clases',
  ),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AsignarInput = z.input<typeof asignarSchema>;
export type SubconjuntoInput = z.input<typeof subconjuntoSchema>;
export type EstadoMateriaInput = z.input<typeof estadoMateriaSchema>;
export type NotaInput = z.input<typeof notaSchema>;
export type ComentarioInput = z.input<typeof comentarioSchema>;
export type RepasoInput = z.input<typeof repasoSchema>;
export type VincularClasesInput = z.input<typeof vincularClasesSchema>;

export type AsignarData = z.output<typeof asignarSchema>;
export type SubconjuntoData = z.output<typeof subconjuntoSchema>;
export type EstadoMateriaData = z.output<typeof estadoMateriaSchema>;
export type NotaData = z.output<typeof notaSchema>;
export type ComentarioData = z.output<typeof comentarioSchema>;
export type RepasoData = z.output<typeof repasoSchema>;
export type VincularClasesData = z.output<typeof vincularClasesSchema>;
