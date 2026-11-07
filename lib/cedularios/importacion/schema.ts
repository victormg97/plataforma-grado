/**
 * Zod v4 schema for the import payload sent to the `importarCedulario` Server Action.
 *
 * Pure TypeScript. Messages are i18n keys relative to `cedularios.errores` (same convention
 * as `../schemas`); existing keys are reused (`materia_padre_invalida`, `nivel_maximo`,
 * `codigo_duplicado_nivel`, `validacion`), so no new error keys are needed.
 *
 * The tree travels flat: every materia names its parent by `key`, parents come before their
 * children, and the server derives depth and `orden` from that order.
 */

import { z } from 'zod';

import { ORDEN_PASO } from '../orden';
import { cedularioSchema, LIMITES } from '../schemas';
import { LIMITES_IMPORTACION } from './tipos';

const claveSchema = z.string({ error: 'materia_padre_invalida' }).min(1, 'materia_padre_invalida').max(64, 'materia_padre_invalida');

export const materiaImportacionSchema = z.object({
  key: claveSchema,
  parentKey: claveSchema.nullable(),
  codigo: z
    .string({ error: 'codigo_requerido' })
    .trim()
    .min(1, 'codigo_requerido')
    .max(LIMITES.materiaCodigo, 'codigo_muy_largo'),
  nombre: z
    .string({ error: 'nombre_requerido' })
    .trim()
    .min(1, 'nombre_requerido')
    .max(LIMITES.materiaNombre, 'nombre_muy_largo'),
});

export const importacionSchema = z
  .object({
    cedulario: cedularioSchema,
    /** Existing empty cedulario to import into; omitted to create a new one. */
    cedulario_id: z.guid({ error: 'validacion' }).optional(),
    materias: z
      .array(materiaImportacionSchema, { error: 'validacion' })
      .min(1, 'validacion')
      .max(LIMITES_IMPORTACION.nodos, 'validacion'),
  })
  .superRefine((datos, ctx) => {
    const profundidades = new Map<string, number>();
    const codigosPorPadre = new Map<string, Set<string>>();
    let errorPadre = false;
    let errorNivel = false;
    let errorCodigo = false;

    datos.materias.forEach((m, i) => {
      if (profundidades.has(m.key)) {
        if (!errorPadre) ctx.addIssue({ code: 'custom', message: 'materia_padre_invalida', path: ['materias', i, 'key'] });
        errorPadre = true;
        return;
      }

      let profundidad = 1;
      if (m.parentKey !== null) {
        const padre = profundidades.get(m.parentKey);
        if (padre === undefined) {
          if (!errorPadre) {
            ctx.addIssue({ code: 'custom', message: 'materia_padre_invalida', path: ['materias', i, 'parentKey'] });
          }
          errorPadre = true;
          return;
        }
        profundidad = padre + 1;
      }
      profundidades.set(m.key, profundidad);

      if (profundidad > LIMITES_IMPORTACION.profundidad && !errorNivel) {
        errorNivel = true;
        ctx.addIssue({ code: 'custom', message: 'nivel_maximo', path: ['materias', i, 'parentKey'] });
      }

      const grupo = m.parentKey ?? '';
      const usados = codigosPorPadre.get(grupo) ?? new Set<string>();
      const normalizado = m.codigo.trim().toLowerCase();
      if (usados.has(normalizado) && !errorCodigo) {
        errorCodigo = true;
        ctx.addIssue({ code: 'custom', message: 'codigo_duplicado_nivel', path: ['materias', i, 'codigo'] });
      }
      usados.add(normalizado);
      codigosPorPadre.set(grupo, usados);
    });
  });

export type ImportacionInput = z.input<typeof importacionSchema>;
export type ImportacionData = z.output<typeof importacionSchema>;
export type MateriaImportacionInput = z.input<typeof materiaImportacionSchema>;

/** Row sent to the `importar_cedulario` RPC (`p_materias` item). */
export interface MateriaRpc {
  id: string;
  parent_id: string | null;
  depth: number;
  codigo: string;
  nombre: string;
  orden: number;
}


/**
 * Turns validated flat materias into RPC rows: random ids (`nuevoId`), depth from the parent
 * link, and `orden` = (position among siblings + 1) * 1024. Parents must precede children
 * (guaranteed by `importacionSchema`).
 */
export function prepararMateriasRpc(
  materias: ImportacionData['materias'],
  nuevoId: () => string,
): MateriaRpc[] {
  const porKey = new Map<string, { id: string; depth: number }>();
  const hijosPorPadre = new Map<string, number>();

  return materias.map((m) => {
    const padre = m.parentKey === null ? null : (porKey.get(m.parentKey) ?? null);
    const depth = padre === null ? 1 : padre.depth + 1;
    const grupo = m.parentKey ?? '';
    const posicion = (hijosPorPadre.get(grupo) ?? 0) + 1;
    hijosPorPadre.set(grupo, posicion);

    const id = nuevoId();
    porKey.set(m.key, { id, depth });
    return {
      id,
      parent_id: padre === null ? null : padre.id,
      depth,
      codigo: m.codigo,
      nombre: m.nombre,
      orden: posicion * ORDEN_PASO,
    };
  });
}
