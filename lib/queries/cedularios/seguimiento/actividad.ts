/**
 * Activity and inactive-materia queries of the per-student tracking (phase 2).
 *
 * Plain async functions that receive a Supabase client. They throw the raw Supabase error so
 * the hooks can wrap them with `consultar`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/types'
import type { HistorialCursor } from '@/lib/queries/cedularios/historial'

type Client = SupabaseClient<Database>

/** Rows per page of the activity tab. */
export const ACTIVIDAD_PAGE_SIZE = 50

/** One entry of the activity of an assignment (same shape as a history entry, plus metadata). */
export interface ActividadItem {
  id: string
  cedularioId: string | null
  tabla: string
  registroId: string
  registroEtiqueta: string | null
  campo: string
  valorAnterior: Json | null
  valorNuevo: Json | null
  usuarioId: string | null
  /** Null when usuarioId is null or the profile no longer exists. */
  usuarioNombre: string | null
  /** Context of the change: asignacion_id, alumno_id and, when it applies, materia_id. */
  metadata: Json | null
  createdAt: string
}

export type ActividadCursor = HistorialCursor

export interface ActividadPage {
  items: ActividadItem[]
  /** Cursor of the last item when a full page came back, otherwise null. */
  nextCursor: ActividadCursor | null
}

/** A deactivated materia that still has progress in an assignment (staff only). */
export interface MateriaInactivaProgreso {
  materiaId: string
  codigo: string
  nombre: string
  nivel: number
  parentId: string | null
  estado: string
  fechaCubierta: string | null
  repasos: number
  comentarios: number
}

/**
 * One page of the activity of an assignment, newest first, keyset paginated by
 * (created_at, id). `cursor` is null for the first page.
 */
export async function fetchActividad(
  client: Client,
  asignacionId: string,
  cursor: ActividadCursor | null
): Promise<ActividadPage> {
  const { data, error } = await client.rpc('get_asignacion_actividad', {
    p_asignacion_id: asignacionId,
    p_limit: ACTIVIDAD_PAGE_SIZE,
    p_cursor_created_at: cursor ? cursor.createdAt : null,
    p_cursor_id: cursor ? cursor.id : null,
  })
  if (error) throw error

  const items: ActividadItem[] = (data ?? []).map((row) => ({
    id: row.id,
    cedularioId: row.cedulario_id,
    tabla: row.tabla,
    registroId: row.registro_id,
    registroEtiqueta: row.registro_etiqueta,
    campo: row.campo,
    valorAnterior: row.valor_anterior,
    valorNuevo: row.valor_nuevo,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    metadata: row.metadata,
    createdAt: row.created_at,
  }))

  const last = items[items.length - 1]
  const nextCursor: ActividadCursor | null =
    items.length === ACTIVIDAD_PAGE_SIZE && last
      ? { createdAt: last.createdAt, id: last.id }
      : null

  return { items, nextCursor }
}

/**
 * Deactivated materias that have progress in an assignment. RLS of phase 1 hides inactive
 * materias from non-admins, so this goes through a dedicated RPC (staff only).
 */
export async function fetchMateriasInactivas(
  client: Client,
  asignacionId: string
): Promise<MateriaInactivaProgreso[]> {
  const { data, error } = await client.rpc('get_asignacion_materias_inactivas', {
    p_asignacion_id: asignacionId,
  })
  if (error) throw error

  return (data ?? []).map((row) => ({
    materiaId: row.materia_id,
    codigo: row.codigo,
    nombre: row.nombre,
    nivel: row.nivel,
    parentId: row.parent_id,
    estado: row.estado,
    fechaCubierta: row.fecha_cubierta,
    repasos: row.repasos,
    comentarios: row.comentarios,
  }))
}
