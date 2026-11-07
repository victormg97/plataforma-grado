/**
 * Impact queries of the per-student cedulario tracking (phase 2).
 *
 * Plain async function that receives a Supabase client. It throws the raw Supabase error so
 * callers can wrap it with `consultar`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Number of distinct students with an active assignment and the materia (or one of its active
 * descendants) marked as assigned. Used by the dialog that deactivates a materia.
 */
export async function fetchAlumnosConMateria(
  client: SupabaseClient<Database>,
  materiaId: string,
): Promise<number> {
  const { data, error } = await client.rpc('contar_alumnos_materia_asignada', {
    p_materia_id: materiaId,
  });

  if (error) throw error;
  return data ?? 0;
}
