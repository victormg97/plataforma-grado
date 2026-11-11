/**
 * Staff counts of the tracking: active cedulario assignments per profesor/administrador, in a
 * single RPC. Users without active assignments are absent from the result (count 0).
 * Throws the raw Supabase error so callers can wrap it with `consultar`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;

/** Map `asignatario_id -> total_activas`. */
export async function fetchConteosStaff(client: Client): Promise<Record<string, number>> {
  const { data, error } = await client.rpc('get_cedularios_staff_resumen');
  if (error) throw error;

  const conteos: Record<string, number> = {};
  for (const fila of data ?? []) {
    conteos[fila.asignatario_id] = Number(fila.total_activas);
  }
  return conteos;
}
