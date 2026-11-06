import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/types'

export const HISTORIAL_PAGE_SIZE = 50

export interface HistorialItem {
  id: string
  tabla: string
  registroId: string
  registroEtiqueta: string | null
  campo: string
  valorAnterior: Json | null
  valorNuevo: Json | null
  usuarioId: string | null
  /** Null when usuarioId is null or the profile no longer exists. */
  usuarioNombre: string | null
  createdAt: string
}

export interface HistorialFiltros {
  tabla?: string
  usuarioId?: string
  /** Inclusive start day, `yyyy-MM-dd`. */
  desde?: string
  /** Inclusive end day, `yyyy-MM-dd`. */
  hasta?: string
}

export interface HistorialCursor {
  createdAt: string
  id: string
}

export interface HistorialPage {
  items: HistorialItem[]
  nextCursor: HistorialCursor | null
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDay(day: string): [number, number, number] {
  const match = DAY_RE.exec(day)
  if (!match) throw new Error(`Invalid date (expected yyyy-MM-dd): ${day}`)
  return [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
}

/**
 * Timezone choice: the day boundaries are the LOCAL (browser) day boundaries,
 * converted to UTC with `toISOString()`. A user in Chile filtering "2025-03-10"
 * therefore sees the records created during their own March 10th.
 */
export function inicioDelDia(day: string): string {
  const [y, m, d] = parseDay(day)
  return new Date(y, m, d, 0, 0, 0, 0).toISOString()
}

/** End of the local day (23:59:59.999), inclusive. See {@link inicioDelDia}. */
export function finDelDia(day: string): string {
  const [y, m, d] = parseDay(day)
  return new Date(y, m, d, 23, 59, 59, 999).toISOString()
}

/**
 * One page of the change history of a cedulario, newest first, keyset
 * paginated by (created_at, id). `nextCursor` is the (created_at, id) of the
 * last item when a full page was returned, otherwise null.
 */
export async function fetchHistorial(
  client: SupabaseClient<Database>,
  cedularioId: string,
  filtros: HistorialFiltros,
  cursor: HistorialCursor | null
): Promise<HistorialPage> {
  const { data, error } = await client.rpc('get_historial_cedulario', {
    p_cedulario_id: cedularioId,
    p_tabla: filtros.tabla || null,
    p_usuario: filtros.usuarioId || null,
    p_desde: filtros.desde ? inicioDelDia(filtros.desde) : null,
    p_hasta: filtros.hasta ? finDelDia(filtros.hasta) : null,
    p_limit: HISTORIAL_PAGE_SIZE,
    p_cursor_created_at: cursor ? cursor.createdAt : null,
    p_cursor_id: cursor ? cursor.id : null,
  })
  if (error) throw error

  const rows = data ?? []
  const items: HistorialItem[] = rows.map((row) => ({
    id: row.id,
    tabla: row.tabla,
    registroId: row.registro_id,
    registroEtiqueta: row.registro_etiqueta,
    campo: row.campo,
    valorAnterior: row.valor_anterior,
    valorNuevo: row.valor_nuevo,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    createdAt: row.created_at,
  }))

  const last = items[items.length - 1]
  const nextCursor: HistorialCursor | null =
    items.length === HISTORIAL_PAGE_SIZE && last
      ? { createdAt: last.createdAt, id: last.id }
      : null

  return { items, nextCursor }
}
