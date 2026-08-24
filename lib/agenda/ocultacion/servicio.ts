/**
 * Slice `ocultacion` — servicio de ocultar/mostrar Actividades (Requisitos 9.1,
 * 9.2, 9.4, 9.5, 9.6, 9.7).
 *
 * Ambas operaciones son idempotentes y no consultan antes de escribir:
 * - `ocultarActividad` usa `upsert` con `ignoreDuplicates: true` (Req 9.2).
 * - `mostrarActividad` hace un `DELETE` que no exige filas afectadas (Req 9.5).
 *
 * Ninguna modifica la fila de la Actividad (Req 9.6).
 *
 * Dependencias permitidas: `@/lib/agenda/compartido`, `@/lib/agenda/nucleo`,
 * `@/lib/supabase/server`.
 */
import {
  ErrorAgenda,
  fallo,
  ok,
  type Resultado,
} from '@/lib/agenda/compartido';
import { leerEventoPorId } from '@/lib/agenda/nucleo';
import type { createClient } from '@/lib/supabase/server';

/** Tipo del cliente de servidor Supabase. */
type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Namespace i18n del slice para los mensajes de error. */
const NAMESPACE = 'agendaOcultacion';

/**
 * Persiste una Ocultacion_Alumno para la combinación `(eventoId, alumnoId)`.
 *
 * - Verifica que el evento exista y sea una Actividad (alcance ≠ 'personal').
 *   Si es Clase o Entrada_Personal → `fallo('no_es_actividad')` (Req 9.8).
 * - `upsert` con `onConflict: 'evento_id,alumno_id'` e `ignoreDuplicates: true`
 *   garantiza idempotencia sin duplicados (Req 9.2).
 * - Si la RLS rechaza el INSERT (el alumno no es destinatario) → el error
 *   se traduce a `fallo('no_es_destinatario')` (Req 9.9).
 * - No modifica la fila de la Actividad (Req 9.6).
 */
export async function ocultarActividad(
  cliente: ServerClient,
  alumnoId: string,
  eventoId: string,
): Promise<Resultado<{ eventoId: string; oculto: true }>> {
  // Verificar que el evento existe y es una Actividad
  const evento = await leerEventoPorId(cliente, eventoId);

  if (!evento) {
    return fallo(new ErrorAgenda('no_encontrado', { namespace: NAMESPACE }));
  }

  if (evento.alcance === 'personal') {
    return fallo(new ErrorAgenda('no_es_actividad', { namespace: NAMESPACE }));
  }

  // Upsert idempotente — ignoreDuplicates evita error si ya existe
  const { error } = await cliente
    .from('agenda_evento_ocultaciones')
    .upsert(
      { evento_id: eventoId, alumno_id: alumnoId },
      { onConflict: 'evento_id,alumno_id', ignoreDuplicates: true },
    );

  if (error) {
    // La RLS rechazó el INSERT: el alumno no es destinatario de esta Actividad
    return fallo(new ErrorAgenda('no_es_destinatario', { namespace: NAMESPACE, causa: error }));
  }

  return ok({ eventoId, oculto: true as const });
}

/**
 * Elimina la Ocultacion_Alumno para la combinación `(eventoId, alumnoId)`.
 *
 * - No verifica si la ocultación existía: si no existe, responde con éxito
 *   igualmente (Req 9.5).
 * - No modifica la fila de la Actividad (Req 9.6).
 */
export async function mostrarActividad(
  cliente: ServerClient,
  alumnoId: string,
  eventoId: string,
): Promise<Resultado<{ eventoId: string; oculto: false }>> {
  await cliente
    .from('agenda_evento_ocultaciones')
    .delete()
    .eq('evento_id', eventoId)
    .eq('alumno_id', alumnoId);

  return ok({ eventoId, oculto: false as const });
}
