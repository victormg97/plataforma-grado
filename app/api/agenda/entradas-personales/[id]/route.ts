/**
 * Ruta `PATCH | DELETE /api/agenda/entradas-personales/[id]` — edición y eliminación
 * de Entrada_Personal.
 *
 * Punto de composición: orquesta el slice `visibilidad` (resolución de contexto) y
 * el slice `entradas-personales` (validación + persistencia). No contiene lógica de
 * negocio propia (Requisito 17.8, 17.11).
 *
 * Requisitos cubiertos: 3.6, 3.7, 3.10, 3.11, 5.4, 5.5, 5.8, 6.11, 14.10, 14.11,
 * 14.12, 14.13, 14.14.
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { desdeZod, respuestaError } from '@/lib/agenda/compartido';
import { resolverContextoLector } from '@/lib/agenda/visibilidad';
import {
  editarEntradaPersonalSchema,
  editarEntradaPersonal,
  eliminarEntradaPersonal,
} from '@/lib/agenda/entradas-personales';

// ─── PATCH — edición ────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── 1. Cliente SSR ligado a la sesión (nunca Clave_Servicio, Req 14.14) ───
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector (Req 14.10) ───────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Validar cuerpo con Zod (Req 3.4, 3.5, 3.9, 5.7) ──────────────────
  const cuerpo = editarEntradaPersonalSchema.safeParse(await request.json());
  if (!cuerpo.success) {
    return respuestaError(
      desdeZod(cuerpo.error, { namespace: 'agendaEntradasPersonales' }),
    );
  }

  // ── 4. Servicio (Req 3.6, 3.7, 5.4, 5.5, 14.12, 14.13) ──────────────────
  const resultado = await editarEntradaPersonal(
    cliente,
    contexto.valor,
    id,
    cuerpo.data,
  );
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 5. Respuesta 200 con advertencias ─────────────────────────────────────
  return Response.json(
    { data: resultado.valor.evento, advertencias: resultado.valor.advertencias },
    { status: 200 },
  );
}

// ─── DELETE — eliminación ───────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── 1. Cliente SSR ligado a la sesión (nunca Clave_Servicio, Req 14.14) ───
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector (Req 14.10) ───────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Servicio (Req 3.10, 3.11, 5.4, 5.8, 14.13) ────────────────────────
  const resultado = await eliminarEntradaPersonal(cliente, contexto.valor, id);
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 4. Respuesta 200 con advertencias vacías ──────────────────────────────
  return Response.json(
    { data: { id: resultado.valor.id }, advertencias: [] },
    { status: 200 },
  );
}
