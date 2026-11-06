import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { MateriaNodo } from '@/lib/cedularios/tree';

type Client = SupabaseClient<Database>;
type MateriaRow = Database['public']['Tables']['materias']['Row'];

/** Maximum length of a search query sent to the server. */
export const BUSQUEDA_MAX_LENGTH = 100;

const COLUMNAS_ESTRUCTURA =
  'id, cedulario_id, parent_id, codigo, nombre, descripcion, nivel, orden, activo, updated_at';

const COLUMNAS_MATERIA =
  'id, cedulario_id, parent_id, codigo, nombre, descripcion, nivel, orden, activo, temario, temario_texto, created_at, updated_at, updated_by';

/** A materia of the structure list: tree node plus metadata, without temario. */
export interface MateriaEstructura extends MateriaNodo {
  cedularioId: string;
  updatedAt: string;
}

type FilaEstructura = Pick<
  MateriaRow,
  | 'id'
  | 'cedulario_id'
  | 'parent_id'
  | 'codigo'
  | 'nombre'
  | 'descripcion'
  | 'nivel'
  | 'orden'
  | 'activo'
  | 'updated_at'
>;

/**
 * Flat list of the materias of a cedulario, without temario, in one request.
 * RLS returns inactive rows to admin only; the tree functions ignore them anyway.
 */
export async function fetchMateriasEstructura(
  client: Client,
  cedularioId: string
): Promise<MateriaEstructura[]> {
  const { data, error } = await client
    .from('materias')
    .select(COLUMNAS_ESTRUCTURA)
    .eq('cedulario_id', cedularioId)
    .order('nivel', { ascending: true })
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as FilaEstructura[]).map((m) => ({
    id: m.id,
    cedularioId: m.cedulario_id,
    parentId: m.parent_id,
    codigo: m.codigo,
    nombre: m.nombre,
    descripcion: m.descripcion,
    nivel: m.nivel,
    orden: m.orden,
    activo: m.activo,
    updatedAt: m.updated_at,
  }));
}

/** Full materia row including temario, or null when it does not exist or is not visible. */
export async function fetchMateria(
  client: Client,
  id: string
): Promise<MateriaRow | null> {
  const { data, error } = await client
    .from('materias')
    .select(COLUMNAS_MATERIA)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as MateriaRow | null) ?? null;
}

/**
 * Server-side search over código, nombre, descripción and temario text.
 * Returns the ids of matching active materias. An empty query returns [] without a request.
 */
export async function buscarMateriasTemario(
  client: Client,
  cedularioId: string,
  q: string
): Promise<string[]> {
  const consulta = q.trim().slice(0, BUSQUEDA_MAX_LENGTH);
  if (consulta === '') return [];

  const { data, error } = await client.rpc('buscar_materias', {
    p_cedulario_id: cedularioId,
    p_q: consulta,
  });

  if (error) throw error;
  return (data ?? []).map((fila) => fila.id);
}
