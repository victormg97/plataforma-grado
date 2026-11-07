'use server';

import { z } from 'zod';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { errorDeDb, obtenerContextoStaff, parsear, parsearId } from '@/lib/cedularios/contexto-accion';
import { toActionError, type CedularioErrorCode } from '@/lib/cedularios/errors';
import { ALUMNOS_POR_LLAMADA } from '@/lib/cedularios/seguimiento/constants';
import { motivoDeRechazo } from '@/lib/cedularios/seguimiento/errores';
import {
  asignarSchema,
  subconjuntoSchema,
  type AsignarInput,
  type SubconjuntoInput,
} from '@/lib/validations/cedularioSeguimiento.schema';

/** Outcome of the assignment for one student. */
export type ResultadoAsignacionAlumno =
  | { alumnoId: string; resultado: 'asignado' | 'reactivado'; asignacionId: string }
  | { alumnoId: string; resultado: 'rechazado'; motivo: CedularioErrorCode };

/** Counters returned when the subset of subjects of an assignment changes. */
export interface ResultadoSubconjunto {
  agregadas: number;
  restauradas: number;
  archivadas: number;
}

/** Codes that describe the whole operation (bad subjects or input), not one student. */
const CODIGOS_DE_OPERACION: ReadonlySet<CedularioErrorCode> = new Set<CedularioErrorCode>([
  'materia_invalida',
  'validacion',
]);

const conteoSchema = z.number().int().nonnegative();

/** Reads one non-negative integer counter out of the `jsonb` returned by the RPC. */
function leerConteo(json: unknown, clave: keyof ResultadoSubconjunto): number {
  if (typeof json !== 'object' || json === null) return 0;
  const parsed = conteoSchema.safeParse((json as Record<string, unknown>)[clave]);
  return parsed.success ? parsed.data : 0;
}

/** Splits a list in consecutive chunks of at most `tamano` items. */
function enBloques<T>(lista: readonly T[], tamano: number): T[][] {
  const bloques: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) {
    bloques.push(lista.slice(i, i + tamano));
  }
  return bloques;
}

export async function asignarCedulario(
  input: AsignarInput,
): Promise<ActionResult<ResultadoAsignacionAlumno[]>> {
  let userId: string | null = null;

  return runAction({ accion: 'asignarCedulario', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(asignarSchema, input);
    if (!datos.ok) return datos;
    const { cedularioId, alumnoIds, materias } = datos.data;

    // `null` asks the RPC for every active subject of the cedulario.
    const materiaIds = materias === 'todas' ? null : materias;
    const resultados: ResultadoAsignacionAlumno[] = [];

    // Chunks run in series so a large cedulario stays under the statement timeout.
    for (const bloque of enBloques(alumnoIds, ALUMNOS_POR_LLAMADA)) {
      const { data, error } = await supabase.rpc('asignar_cedulario_alumnos', {
        p_cedulario_id: cedularioId,
        p_alumno_ids: bloque,
        p_materia_ids: materiaIds,
      });

      if (error) {
        const codigo = toActionError(error).code;
        // Nothing was applied yet and the problem is not about one student: fail the operation.
        if (resultados.length === 0 && CODIGOS_DE_OPERACION.has(codigo)) {
          return { ok: false, error: toActionError(error) };
        }
        // A chunk that fails as a whole rejects its students; the other chunks continue.
        const motivo = motivoDeRechazo(error);
        for (const alumnoId of bloque) {
          resultados.push({ alumnoId, resultado: 'rechazado', motivo });
        }
        continue;
      }

      const porAlumno = new Map((data ?? []).map((fila) => [fila.alumno_id, fila]));
      for (const alumnoId of bloque) {
        const fila = porAlumno.get(alumnoId);
        if (
          fila &&
          (fila.resultado === 'asignado' || fila.resultado === 'reactivado') &&
          fila.asignacion_id
        ) {
          resultados.push({ alumnoId, resultado: fila.resultado, asignacionId: fila.asignacion_id });
        } else {
          // A missing row or an explicit rejection: keep the reason when the RPC gave one.
          const motivo = fila?.motivo ? motivoDeRechazo(fila.motivo) : 'error_generico';
          resultados.push({ alumnoId, resultado: 'rechazado', motivo });
        }
      }
    }

    return actionOk(resultados);
  });
}

export async function desasignarCedulario(input: {
  asignacionId: string;
}): Promise<ActionResult<{ cambio: boolean }>> {
  let userId: string | null = null;

  return runAction({ accion: 'desasignarCedulario', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const id = parsearId(input?.asignacionId);
    if (!id.ok) return actionFail('validacion');

    // No `.select()` afterwards: the row stops being visible to a non-admin once unassigned.
    const { data, error } = await supabase.rpc('desasignar_cedulario_alumno', {
      p_asignacion_id: id.data,
    });

    if (error) return errorDeDb(error);
    return actionOk({ cambio: data === true });
  });
}

export async function establecerMateriasAsignadas(
  input: SubconjuntoInput,
): Promise<ActionResult<ResultadoSubconjunto>> {
  let userId: string | null = null;

  return runAction({ accion: 'establecerMateriasAsignadas', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(subconjuntoSchema, input);
    if (!datos.ok) return datos;
    const { asignacionId, agregar, quitar } = datos.data;

    // No `.select()` afterwards: removing subjects can hide rows from a non-admin.
    const { data, error } = await supabase.rpc('establecer_materias_asignadas', {
      p_asignacion_id: asignacionId,
      p_agregar: agregar,
      p_quitar: quitar,
    });

    if (error) return errorDeDb(error);
    return actionOk({
      agregadas: leerConteo(data, 'agregadas'),
      restauradas: leerConteo(data, 'restauradas'),
      archivadas: leerConteo(data, 'archivadas'),
    });
  });
}
