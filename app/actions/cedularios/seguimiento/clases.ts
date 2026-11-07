'use server';

import { actionFail, actionOk, runAction, type ActionResult } from '@/lib/cedularios/action-result';
import { errorDeDb, obtenerContextoStaff, parsear, parsearId } from '@/lib/cedularios/contexto-accion';
import { vincularClasesSchema } from '@/lib/validations/cedularioSeguimiento.schema';

/**
 * Links classes of the student to a subject progress row.
 * Already linked classes are ignored by the RPC without error. A class that belongs to
 * another student (CD013) reverts the whole call and maps to `clase_otro_alumno`.
 */
export async function vincularClases(input: {
  progresoId: string;
  horarioIds: string[];
}): Promise<ActionResult<{ vinculadas: number }>> {
  let userId: string | null = null;

  return runAction({ accion: 'vincularClases', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const datos = parsear(vincularClasesSchema, input);
    if (!datos.ok) return datos;

    const { data, error } = await supabase.rpc('vincular_clases_progreso', {
      p_progreso_id: datos.data.progresoId,
      p_horario_ids: datos.data.horarioIds,
    });

    if (error) return errorDeDb(error);
    return actionOk({ vinculadas: data ?? 0 });
  });
}

/** Removes the link between a class and a subject progress row. */
export async function desvincularClase(input: { id: string }): Promise<ActionResult<void>> {
  let userId: string | null = null;

  return runAction({ accion: 'desvincularClase', userId: () => userId }, async () => {
    const contexto = await obtenerContextoStaff();
    if (!contexto.ok) return contexto;
    const { supabase } = contexto.data;
    userId = contexto.data.userId;

    const idValido = parsearId(input?.id);
    if (!idValido.ok) return idValido;

    const { error, count } = await supabase
      .from('materia_progreso_clases')
      .delete({ count: 'exact' })
      .eq('id', idValido.data);

    if (error) return errorDeDb(error);
    // Zero rows: RLS filtered the delete or the link no longer exists.
    if (!count) return actionFail('sin_permisos');
    return actionOk();
  });
}
