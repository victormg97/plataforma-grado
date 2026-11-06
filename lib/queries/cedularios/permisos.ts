import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface Colaborador {
  /** Profesor (profile) id. */
  id: string
  nombre: string
  apellido: string
  grantedBy: string | null
  createdAt: string
}

export interface ProfesorDisponible {
  id: string
  nombre: string
  apellido: string
}

/**
 * Collaborators of a cedulario, joined with the profile name by the
 * `listar_colaboradores` RPC.
 */
export async function fetchColaboradores(
  client: SupabaseClient<Database>,
  cedularioId: string
): Promise<Colaborador[]> {
  const { data, error } = await client.rpc('listar_colaboradores', {
    p_cedulario_id: cedularioId,
  })
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    grantedBy: row.granted_by,
    createdAt: row.created_at,
  }))
}

export interface CreadorCedulario {
  id: string
  nombre: string
  apellido: string
}

/**
 * Creator of a cedulario (id and name), through the `obtener_creador_cedulario` RPC. Profesores
 * cannot read other profiles with RLS, hence the DEFINER function. `null` when the RPC returns no
 * row (creator unknown or removed, cedulario not visible, caller not admin or profesor).
 */
export async function fetchCreadorCedulario(
  client: SupabaseClient<Database>,
  cedularioId: string
): Promise<CreadorCedulario | null> {
  const { data, error } = await client.rpc('obtener_creador_cedulario', {
    p_cedulario_id: cedularioId,
  })
  if (error) throw error

  const fila = (data ?? [])[0]
  if (!fila) return null
  return { id: fila.id, nombre: fila.nombre, apellido: fila.apellido }
}

/**
 * All profesores that can be granted access. The UI filters out the creator
 * and the existing collaborators.
 */
export async function fetchProfesoresDisponibles(
  client: SupabaseClient<Database>
): Promise<ProfesorDisponible[]> {
  const { data, error } = await client.rpc('listar_profesores_cedularios')
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
  }))
}
