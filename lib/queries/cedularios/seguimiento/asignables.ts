/**
 * Pickers of the per-student tracking (phase 2): students that can be assigned a cedulario
 * and classes that can be linked to a materia progress.
 *
 * Plain async functions that receive a Supabase client. They throw the raw Supabase error so
 * the hooks can wrap them with `consultar`. Pages are offset based; a full page means there
 * may be more rows. The wildcard escaping of the search text is done by the RPC.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { SEG_BUSQUEDA_MAX } from '@/lib/cedularios/seguimiento/constants'

type Client = SupabaseClient<Database>

/** Rows per page of both pickers. */
export const ASIGNABLES_PAGE_SIZE = 50

/** A student that can receive an assignment. */
export interface AlumnoAsignable {
  id: string
  nombre: string
  apellido: string
  apellidoMaterno: string | null
  email: string
  avatarUrl: string | null
  /** True when the student already has an active assignment of the cedulario. */
  yaAsignado: boolean
}

/** A class of the student that can be linked to a materia progress. */
export interface ClaseVinculable {
  id: string
  titulo: string
  fecha: string
  horaInicio: string
  horaFin: string
  activo: boolean
  /** True when the class is already linked to some materia of the assignment. */
  yaVinculada: boolean
}

export interface AlumnosAsignablesParams {
  cedularioId: string
  q: string
  offset: number
}

/** Trims the search text and caps it; empty text means no filter. */
function normalizarBusqueda(q: string): string | null {
  const texto = q.trim().slice(0, SEG_BUSQUEDA_MAX)
  return texto === '' ? null : texto
}

/** One page of active students the current user can assign `cedularioId` to. */
export async function fetchAlumnosAsignables(
  client: Client,
  { cedularioId, q, offset }: AlumnosAsignablesParams
): Promise<AlumnoAsignable[]> {
  const { data, error } = await client.rpc('listar_alumnos_asignables', {
    p_cedulario_id: cedularioId,
    p_q: normalizarBusqueda(q),
    p_limit: ASIGNABLES_PAGE_SIZE,
    p_offset: offset,
  })
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    apellidoMaterno: row.apellido_materno,
    email: row.email,
    avatarUrl: row.avatar_url,
    yaAsignado: row.ya_asignado,
  }))
}

/** One page of the classes of the student of an assignment, newest date first. */
export async function fetchClasesVinculables(
  client: Client,
  asignacionId: string,
  q: string,
  offset: number
): Promise<ClaseVinculable[]> {
  const { data, error } = await client.rpc('listar_clases_vinculables', {
    p_asignacion_id: asignacionId,
    p_q: normalizarBusqueda(q),
    p_limit: ASIGNABLES_PAGE_SIZE,
    p_offset: offset,
  })
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    fecha: row.fecha,
    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin,
    activo: row.activo,
    yaVinculada: row.ya_vinculada,
  }))
}
