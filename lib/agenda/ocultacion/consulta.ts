/**
 * Slice `ocultacion` — consulta de Actividades ocultas (Requisitos 9.11, 9.12).
 *
 * Una sola query: `agenda_evento_ocultaciones` con join a `agenda_eventos` (que a
 * su vez tiene la RLS `agenda_recibe_actividad` para excluir las Actividades que
 * el alumno ya no recibe). El filtro por `fecha` en el rango usa el índice
 * `idx_agenda_ocultaciones_alumno`.
 *
 * Dependencias permitidas: `@/lib/agenda/nucleo` (nivel 0).
 */
import type { RangoVisible } from '@/lib/agenda/nucleo';
import type { createClient as createServerClient } from '@/lib/supabase/server';
import type { createClient as createBrowserClient } from '@/lib/supabase/client';

/** Tipo del cliente de servidor Supabase. */
type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/** Tipo del cliente de navegador Supabase. */
type BrowserClient = ReturnType<typeof createBrowserClient>;

/** DTO público de una Actividad oculta dentro de un Rango_Visible. */
export interface ActividadOculta {
  eventoId: string;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

/**
 * Select explícito: trae el ID de la ocultación y el join al evento con los
 * campos necesarios para la interfaz.
 */
const OCULTACION_SELECT = `
  id,
  evento_id,
  evento:agenda_eventos!agenda_evento_ocultaciones_evento_id_fkey(
    titulo,
    fecha,
    hora_inicio,
    hora_fin,
    activo
  )
` as const;

/**
 * Lee las Actividades ocultas por el alumno autenticado dentro del Rango_Visible.
 *
 * La RLS de `agenda_evento_ocultaciones` ya limita a las filas del propio alumno.
 * La RLS de `agenda_eventos` (política SELECT) aplica `agenda_recibe_actividad`,
 * de modo que si el alumno dejó de recibir la Actividad, el join devuelve `null`
 * y la fila se descarta (Req 9.11).
 *
 * Acepta tanto un cliente de servidor como un cliente de navegador, para reutilizar
 * la misma lógica en el hook del cliente y en la ruta de API.
 */
export async function leerActividadesOcultas(
  cliente: ServerClient | BrowserClient,
  rango: RangoVisible,
): Promise<ActividadOculta[]> {
  const { data, error } = await cliente
    .from('agenda_evento_ocultaciones')
    .select(OCULTACION_SELECT)
    .gte('evento.fecha', rango.desde)
    .lte('evento.fecha', rango.hasta)
    .eq('evento.activo', true);

  if (error || !data) return [];

  // Filtrar filas cuyo join a agenda_eventos fue rechazado por RLS (evento === null)
  // y mapear al DTO público.
  const resultado: ActividadOculta[] = [];

  for (const fila of data) {
    const evento = fila.evento as unknown as {
      titulo: string;
      fecha: string;
      hora_inicio: string;
      hora_fin: string;
      activo: boolean;
    } | null;

    if (!evento) continue;

    resultado.push({
      eventoId: fila.evento_id,
      titulo: evento.titulo,
      fecha: evento.fecha,
      hora_inicio: evento.hora_inicio,
      hora_fin: evento.hora_fin,
    });
  }

  return resultado;
}
