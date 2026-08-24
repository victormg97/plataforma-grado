/**
 * Ruta `DELETE /api/agenda/ocultaciones/[eventoId]` — mostrar de nuevo una
 * Actividad que el alumno había ocultado (Requisitos 9.4, 9.5, 14.7, 14.11,
 * 17.11).
 *
 * Punto de composición: orquesta `visibilidad` (resolución de contexto) y
 * `ocultacion` (servicio). No contiene lógica de negocio propia (Requisito 17.8).
 *
 * Responde `200` tanto cuando se elimina la ocultación como cuando no existía
 * ninguna (idempotencia, Requisito 9.5).
 */
import { createClient } from '@/lib/supabase/server';
import { respuestaError } from '@/lib/agenda/compartido';
import { resolverContextoLector } from '@/lib/agenda/visibilidad';
import { mostrarActividad } from '@/lib/agenda/ocultacion';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventoId: string }> },
) {
  const { eventoId } = await params;

  // ── 1. Cliente SSR ligado a la sesión ─────────────────────────────────────
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector ───────────────────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Servicio ───────────────────────────────────────────────────────────
  const resultado = await mostrarActividad(cliente, contexto.valor.id, eventoId);
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 4. Respuesta 200 ─────────────────────────────────────────────────────
  return Response.json(
    { data: resultado.valor, advertencias: [] },
    { status: 200 },
  );
}
