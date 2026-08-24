/**
 * Ruta `POST /api/agenda/entradas-personales` — creación de Entrada_Personal.
 *
 * Punto de composición: orquesta el slice `visibilidad` (resolución de contexto) y
 * el slice `entradas-personales` (validación + persistencia). No contiene lógica de
 * negocio propia (Requisito 17.8, 17.11).
 *
 * Requisitos cubiertos: 3.1, 3.3, 3.4, 3.5, 3.9, 5.1, 5.2, 5.7, 6.2, 6.11, 7.2,
 * 7.5, 14.10, 14.11, 14.12, 14.14.
 */
import { createClient } from '@/lib/supabase/server';
import { desdeZod, respuestaError } from '@/lib/agenda/compartido';
import { resolverContextoLector } from '@/lib/agenda/visibilidad';
import {
  crearEntradaPersonalSchema,
  crearEntradaPersonal,
} from '@/lib/agenda/entradas-personales';

export async function POST(request: Request) {
  // ── 1. Cliente SSR ligado a la sesión (nunca Clave_Servicio, Req 14.14) ───
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector (Req 14.10) ───────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Validar cuerpo con Zod (Req 3.3, 3.4, 3.5, 3.9, 5.7) ─────────────
  const cuerpo = crearEntradaPersonalSchema.safeParse(await request.json());
  if (!cuerpo.success) {
    return respuestaError(
      desdeZod(cuerpo.error, { namespace: 'agendaEntradasPersonales' }),
    );
  }

  // ── 4. Servicio (Req 3.1, 5.1, 6.2, 7.2, 14.12) ─────────────────────────
  const resultado = await crearEntradaPersonal(cliente, contexto.valor, cuerpo.data);
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 5. Respuesta 201 con advertencias (diseño § Components and Interfaces) ─
  return Response.json(
    { data: resultado.valor.evento, advertencias: resultado.valor.advertencias },
    { status: 201 },
  );
}
