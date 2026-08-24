/**
 * Slice `actividades` — eliminación de Actividad (Requisitos 4.13, 4.14, 4.15).
 *
 * Lógica:
 * 1. Leer evento existente. Si no existe o no es Actividad → `fallo('no_encontrado')`.
 * 2. Verificar permiso: Autor o Admin (Req 4.14); nadie más → `fallo('sin_permiso')`.
 * 3. DELETE físico del evento. El CASCADE de la migración 108 arrastra
 *    Destinatario_Explicito y Ocultacion_Alumno.
 * 4. Devuelve `ok({ id })`.
 *
 * No crea registros en `asistencia` ni `pruebas` (Requisito 4.11).
 *
 * Dependencias: `compartido` (nivel 0), `nucleo` (nivel 0).
 * No importa ningún otro slice de capacidad (Requisito 17.5).
 */
import {
  ErrorAgenda,
  fallo,
  ok,
  type Resultado,
} from '@/lib/agenda/compartido';

import { leerEventoPorId } from '@/lib/agenda/nucleo';

import type { UserRol } from '@/lib/supabase/types';
import type { createClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface AutorServicio {
  id: string;
  rol: UserRol;
}

interface ResultadoEliminacion {
  id: string;
}

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Elimina físicamente una Actividad. El CASCADE de la migración 108 arrastra las
 * filas de `agenda_evento_destinatarios` y `agenda_evento_ocultaciones` asociadas.
 *
 * - Autor puede eliminar su propia Actividad.
 * - Admin puede eliminar la Actividad de cualquier editor (Req 4.14).
 * - Nadie más puede (Req 4.15).
 */
export async function eliminarActividad(
  cliente: ServerClient,
  autor: AutorServicio,
  eventoId: string,
): Promise<Resultado<ResultadoEliminacion>> {
  // ── 1. Leer evento existente ──────────────────────────────────────────────
  const existente = await leerEventoPorId(cliente, eventoId);

  if (!existente) {
    return fallo(new ErrorAgenda('no_encontrado'));
  }

  // Verificar que es una Actividad (alcance distinto de 'personal')
  if (existente.alcance === 'personal') {
    return fallo(new ErrorAgenda('no_encontrado'));
  }

  // ── 2. Verificar permiso (Req 4.14, 4.15) ────────────────────────────────
  const esAutor = existente.creador_id === autor.id;
  const esAdmin = autor.rol === 'admin';

  if (!esAutor && !esAdmin) {
    return fallo(new ErrorAgenda('sin_permiso'));
  }

  // ── 3. DELETE físico (Req 4.13: CASCADE arrastra destinatarios + ocultaciones)
  const { error } = await cliente
    .from('agenda_eventos')
    .delete()
    .eq('id', eventoId);

  if (error) {
    return fallo(new ErrorAgenda('no_encontrado', { causa: error }));
  }

  return ok({ id: eventoId });
}
