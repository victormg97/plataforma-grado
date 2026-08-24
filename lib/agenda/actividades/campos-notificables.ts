/**
 * Campos_Notificables — Requisitos 13.15 y 13.16
 *
 * Define qué campos de una Actividad, al modificarse, obligan a
 * re-notificar a los destinatarios. Cambios en título, descripción,
 * categoría, nota, visibilidad o lista de destinatarios NO disparan
 * re-notificación.
 */

import type { AgendaEvento } from '@/lib/supabase/types';

export const CAMPOS_NOTIFICABLES = [
  'fecha',
  'hora_inicio',
  'hora_fin',
  'lugar',
  'enlace_conexion',
] as const;

type CampoNotificable = (typeof CAMPOS_NOTIFICABLES)[number];

/**
 * Compara los campos notificables entre el estado anterior y el nuevo
 * de una Actividad. Devuelve `true` si al menos uno difiere.
 */
export function cambiaronCamposNotificables(
  antes: Pick<AgendaEvento, CampoNotificable>,
  despues: Pick<AgendaEvento, CampoNotificable>,
): boolean {
  return CAMPOS_NOTIFICABLES.some(
    (campo) => (antes[campo] ?? null) !== (despues[campo] ?? null),
  );
}
