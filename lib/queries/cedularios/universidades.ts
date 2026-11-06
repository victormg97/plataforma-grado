/**
 * Universidades queries (Requirements 1.11, 1.12, 2.16, 16.5).
 *
 * Plain async functions that receive a Supabase client, so they run in the browser (React Query
 * hooks) or on the server. They throw the Supabase error so callers can pass it to `mapDbError`.
 *
 * Row-level security decides the visible rows: active universidades for every authenticated
 * user, active and inactive ones for admin. No `activo` filter is applied here.
 *
 * Active cedulario counts per universidad (shown on the cards) are NOT queried here. The cedularios
 * list (`fetchCedularios`) already carries `universidadId` and `activo`, so the count is derived
 * client-side with `contarCedulariosActivosPorUniversidad` (in `cedularios.ts`) and costs no
 * extra request.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export type Universidad = Pick<
  Database['public']['Tables']['universidades']['Row'],
  'id' | 'nombre' | 'codigo' | 'logo_url' | 'activo' | 'created_by' | 'created_at' | 'updated_at'
>;

const UNIVERSIDAD_COLUMNS = 'id, nombre, codigo, logo_url, activo, created_by, created_at, updated_at';

/** Universidades visible to the current user, ordered by nombre. */
export async function fetchUniversidades(client: SupabaseClient<Database>): Promise<Universidad[]> {
  const { data, error } = await client
    .from('universidades')
    .select(UNIVERSIDAD_COLUMNS)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
