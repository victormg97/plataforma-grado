/**
 * Slice `entradas-personales` — eliminacion de Entrada_Personal (Requisitos 3.10,
 * 3.11, 5.4, 5.5, 5.8, 14.13).
 *
 * La eliminacion es un `UPDATE activo = false` (soft delete) que conserva sin cambios
 * Clases, Bloqueos_Horario y las demas Entradas_Personales del Autor (Requisito 3.10).
 *
 * - `404` para identificador inexistente o `activo = false` (Requisito 3.11, 5.8).
 * - `403` para quien no es el Autor, incluido un Admin (Requisito 3.7).
 *
 * Devuelve `Resultado` en lugar de lanzar. El route handler decide el HTTP status.
 *
 * Dependencias: `compartido` (nivel 0), `nucleo` (nivel 0).
 * No importa ningun otro slice de capacidad (Requisito 17.5).
 */
import {
  ErrorAgenda,
  fallo,
  ok,
  type Resultado,
} from '@/lib/agenda/compartido';

import { desactivarEvento, leerEventoPorId } from '@/lib/agenda/nucleo';

import type { UserRol } from '@/lib/supabase/types';
import type { createClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Tipos de entrada ───────────────────────────────────────────────────────

interface AutorServicio {
  id: string;
  rol: UserRol;
}

interface ResultadoEliminacion {
  id: string;
}

// ─── Funcion principal ──────────────────────────────────────────────────────

/**
 * Elimina (soft delete) una Entrada_Personal existente.
 *
 * Verifica autoría antes de desactivar. Un Admin **no** puede eliminar la
 * Entrada_Personal de otro usuario (Requisito 3.7).
 */
export async function eliminarEntradaPersonal(
  cliente: ServerClient,
  autor: AutorServicio,
  eventoId: string,
): Promise<Resultado<ResultadoEliminacion>> {
  // ── 1. Verificar existencia y autoria ─────────────────────────────────────
  const existente = await leerEventoPorId(cliente, eventoId);

  if (!existente) {
    return fallo(new ErrorAgenda('no_encontrado'));
  }

  // Verificar que es una Entrada_Personal (alcance = 'personal').
  if (existente.alcance !== 'personal') {
    return fallo(new ErrorAgenda('no_encontrado'));
  }

  // Requisito 3.7: ni siquiera un Admin puede eliminar una EP ajena.
  if (existente.creador_id !== autor.id) {
    return fallo(new ErrorAgenda('sin_permiso'));
  }

  // ── 2. Desactivar (soft delete) ───────────────────────────────────────────
  const resultado = await desactivarEvento(cliente, eventoId);

  if (!resultado.ok) {
    return fallo(resultado.error);
  }

  return ok({ id: resultado.valor.id });
}
