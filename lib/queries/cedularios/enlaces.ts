import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;

export type EnlaceScope = 'cedulario' | 'materia';

/** Common shape of cedulario_enlaces and materia_enlaces rows. */
export interface Enlace {
  id: string;
  url: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
  /** cedulario_id for scope 'cedulario', materia_id for scope 'materia'. */
  ownerId: string;
}

interface FilaEnlace {
  id: string;
  url: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
}

const COLUMNAS_COMUNES = 'id, url, titulo, descripcion, orden, created_at, updated_at';

/**
 * Enlaces of a cedulario (`parentId` = cedulario id) or of a materia (`parentId` = materia id),
 * ordered by `orden` then `id`.
 */
export async function fetchEnlaces(
  client: Client,
  scope: EnlaceScope,
  parentId: string
): Promise<Enlace[]> {
  const aEnlace = (f: FilaEnlace): Enlace => ({
    id: f.id,
    url: f.url,
    titulo: f.titulo,
    descripcion: f.descripcion,
    orden: f.orden,
    created_at: f.created_at,
    updated_at: f.updated_at,
    ownerId: parentId,
  });

  if (scope === 'cedulario') {
    const { data, error } = await client
      .from('cedulario_enlaces')
      .select(COLUMNAS_COMUNES)
      .eq('cedulario_id', parentId)
      .order('orden', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as FilaEnlace[]).map(aEnlace);
  }

  const { data, error } = await client
    .from('materia_enlaces')
    .select(COLUMNAS_COMUNES)
    .eq('materia_id', parentId)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as FilaEnlace[]).map(aEnlace);
}
