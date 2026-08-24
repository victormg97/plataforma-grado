/**
 * Slice `nucleo` — acceso a datos de `agenda_eventos` (Requisitos 12.6, 17.1, 17.2).
 *
 * Funciones de servidor que reciben un cliente Supabase tipado. Cada función hace
 * UNA sola query con joins explícitos (sin N+1) y selects específicos (sin
 * `select('*')`).
 *
 * `desactivarEvento` es un soft-delete (`activo = false`), no un `DELETE` físico
 * (Requisitos 3.10, 5.4).
 *
 * Dependencias permitidas: `@/lib/agenda/compartido`, `@/lib/supabase/*`.
 */
import {
  ErrorAgenda,
  desdeErrorPostgrest,
  fallo,
  ok,
  type Resultado,
} from '@/lib/agenda/compartido';
import type { createClient } from '@/lib/supabase/server';

import type { AutorResumen } from './tipos';

/** Tipo del cliente de servidor Supabase. */
type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Fila de `agenda_eventos` con el join a `profiles` para construir `AutorResumen`.
 * El select es explícito para minimizar el payload (Requisito 12.11).
 */
const EVENTO_CON_AUTOR_SELECT = `
  id, creador_id, titulo, descripcion, nota, categoria, alcance, visibilidad,
  fecha, hora_inicio, hora_fin, dia_completo, lugar, enlace_conexion, activo,
  created_at, updated_at,
  autor:profiles!agenda_eventos_creador_id_fkey(id, nombre, apellido, rol)
` as const;

/** Tipo de la fila que devuelve el select con join a profiles. */
export interface FilaEventoConAutor {
  id: string;
  creador_id: string;
  titulo: string;
  descripcion: string | null;
  nota: string | null;
  categoria: string;
  alcance: string;
  visibilidad: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  dia_completo: boolean;
  lugar: string | null;
  enlace_conexion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  autor: AutorResumen;
}

/**
 * Lee un Evento_Agenda por su identificador, con el join a `profiles` para el
 * `AutorResumen`. Devuelve `null` si el evento no existe o no está activo.
 *
 * La RLS se encarga de restringir el acceso; aquí solo se filtra `activo = true`
 * para no devolver eventos soft-deleted.
 */
export async function leerEventoPorId(
  supabase: ServerClient,
  eventoId: string,
): Promise<FilaEventoConAutor | null> {
  const { data, error } = await supabase
    .from('agenda_eventos')
    .select(EVENTO_CON_AUTOR_SELECT)
    .eq('id', eventoId)
    .eq('activo', true)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  return data as unknown as FilaEventoConAutor;
}

/**
 * Desactiva un Evento_Agenda (`UPDATE activo = false`). Soft-delete según los
 * Requisitos 3.10 y 5.4. La RLS impide desactivar eventos ajenos para roles sin
 * permiso de `UPDATE`.
 */
export async function desactivarEvento(
  supabase: ServerClient,
  eventoId: string,
): Promise<Resultado<{ id: string }>> {
  const { data, error } = await supabase
    .from('agenda_eventos')
    .update({ activo: false })
    .eq('id', eventoId)
    .eq('activo', true)
    .select('id')
    .maybeSingle();

  if (error) {
    const errorAgenda = desdeErrorPostgrest(error);
    return fallo(errorAgenda ?? new ErrorAgenda('no_encontrado'));
  }

  if (!data) {
    return fallo(new ErrorAgenda('no_encontrado'));
  }

  return ok({ id: data.id });
}
