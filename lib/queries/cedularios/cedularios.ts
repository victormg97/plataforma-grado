/**
 * Cedularios queries (Requirements 1.11, 1.12, 2.16, 11.1, 11.2, 14.4, 16.5).
 *
 * Plain async functions that receive a Supabase client, so they run in the browser (React Query
 * hooks) or on the server. They throw the Supabase error so callers can pass it to `mapDbError`.
 *
 * Row-level security decides the visible rows (inactive cedularios only reach admin).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { CedularioListItem } from '@/lib/cedularios/busqueda';

type CedularioRow = Database['public']['Tables']['cedularios']['Row'];

/** Full cedulario row (with `normativa` and `rubrica`) plus the universidad name and logo. */
export type CedularioDetalle = Pick<
  CedularioRow,
  | 'id'
  | 'universidad_id'
  | 'nombre'
  | 'version'
  | 'descripcion'
  | 'normativa'
  | 'rubrica'
  | 'activo'
  | 'created_by'
  | 'created_at'
  | 'updated_by'
  | 'updated_at'
> & {
  universidad: { nombre: string; logo_url: string | null } | null;
};

// Skinny list: no normativa / rubrica. `universidades(nombre)` is a many-to-one embed through
// cedularios_universidad_id_fkey.
const LIST_SELECT = 'id, nombre, version, universidad_id, updated_at, activo, created_by, universidades(nombre, logo_url)';

const DETAIL_SELECT =
  'id, universidad_id, nombre, version, descripcion, normativa, rubrica, activo, created_by, created_at, updated_by, updated_at, universidades(nombre, logo_url)';

/** Cedularios visible to the current user, skinny, most recently updated first. */
export async function fetchCedularios(client: SupabaseClient<Database>): Promise<CedularioListItem[]> {
  const { data, error } = await client
    .from('cedularios')
    .select(LIST_SELECT)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    nombre: row.nombre,
    version: row.version ?? '',
    universidadId: row.universidad_id,
    universidadNombre: row.universidades?.nombre ?? '',
    universidadLogoUrl: row.universidades?.logo_url ?? null,
    updated_at: row.updated_at,
    activo: row.activo,
    createdBy: row.created_by,
  }));
}

/** One cedulario with `normativa` and `rubrica`, or `null` when it does not exist or is not visible. */
export async function fetchCedulario(
  client: SupabaseClient<Database>,
  id: string,
): Promise<CedularioDetalle | null> {
  const { data, error } = await client
    .from('cedularios')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { universidades, ...cedulario } = data;
  return { ...cedulario, universidad: universidades ?? null };
}

/**
 * Number of active cedularios per universidad id, computed from the list already fetched by
 * `fetchCedularios` (no extra request). Universidades without active cedularios are absent
 * from the map, so read counts with `map.get(id) ?? 0`.
 */
export function contarCedulariosActivosPorUniversidad(
  items: readonly Pick<CedularioListItem, 'universidadId' | 'activo'>[],
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const c of items) {
    if (!c.activo) continue;
    conteo.set(c.universidadId, (conteo.get(c.universidadId) ?? 0) + 1);
  }
  return conteo;
}
