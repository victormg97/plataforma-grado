/**
 * Slice `nucleo` — consulta de eventos por Rango_Visible (Requisito 12.11, 17.1).
 *
 * Se apoya en el índice `idx_agenda_eventos_fecha` filtrando `activo = true` y
 * `fecha` entre `desde` y `hasta`. Una sola query con join a `profiles` para el
 * `AutorResumen` — sin N+1.
 *
 * Dependencias permitidas: `@/lib/supabase/*`.
 */
import type { createClient } from '@/lib/supabase/server';

import type { FilaEventoConAutor } from './repositorio';
import type { RangoVisible } from './tipos';

/** Tipo del cliente de servidor Supabase. */
type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Select explícito con join a profiles. Misma forma que `repositorio.ts` para
 * reutilizar `FilaEventoConAutor`.
 */
const EVENTO_RANGO_SELECT = `
  id, creador_id, titulo, descripcion, nota, categoria, alcance, visibilidad,
  fecha, hora_inicio, hora_fin, dia_completo, lugar, enlace_conexion, activo,
  created_at, updated_at,
  autor:profiles!agenda_eventos_creador_id_fkey(id, nombre, apellido, rol)
` as const;

/**
 * Lee los Eventos_Agenda activos dentro de un `RangoVisible`, con el join a
 * `profiles` para el `AutorResumen`.
 *
 * La RLS (`agenda_eventos_select`) controla qué filas son visibles para el
 * usuario autenticado. El índice `idx_agenda_eventos_fecha` cubre la condición
 * `activo AND fecha BETWEEN desde AND hasta`.
 *
 * @returns Array de filas con autor. Array vacío en caso de error o sin datos.
 */
export async function leerEventosEnRango(
  supabase: ServerClient,
  rango: RangoVisible,
): Promise<FilaEventoConAutor[]> {
  const { data, error } = await supabase
    .from('agenda_eventos')
    .select(EVENTO_RANGO_SELECT)
    .eq('activo', true)
    .gte('fecha', rango.desde)
    .lte('fecha', rango.hasta)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) return [];

  return (data ?? []) as unknown as FilaEventoConAutor[];
}
