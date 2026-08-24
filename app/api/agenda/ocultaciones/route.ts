/**
 * Ruta `POST /api/agenda/ocultaciones` — ocultar una Actividad del calendario
 * del alumno (Requisitos 9.1, 9.2, 9.4, 9.5, 9.8, 9.9, 14.7, 14.11, 17.11).
 *
 * Punto de composición: orquesta `visibilidad` (resolución de contexto) y
 * `ocultacion` (validación + servicio). No contiene lógica de negocio propia
 * (Requisito 17.8).
 *
 * Responde `200` tanto en creación exitosa como cuando la ocultación ya existía
 * (idempotencia, Requisito 9.2).
 *
 * Códigos de error:
 * - 400: el evento es una Clase o una Entrada_Personal (alcance === 'personal')
 * - 401: sin sesión
 * - 403: el alumno no es destinatario de la Actividad
 * - 404: el evento no existe
 */
import { createClient } from '@/lib/supabase/server';
import { desdeZod, respuestaError } from '@/lib/agenda/compartido';
import { resolverContextoLector } from '@/lib/agenda/visibilidad';
import { ocultarActividadSchema, ocultarActividad } from '@/lib/agenda/ocultacion';

export async function POST(request: Request) {
  // ── 1. Cliente SSR ligado a la sesión ─────────────────────────────────────
  const cliente = await createClient();

  // ── 2. Resolver contexto del lector ───────────────────────────────────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 3. Validar cuerpo ─────────────────────────────────────────────────────
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    cuerpo = {};
  }

  const parse = ocultarActividadSchema.safeParse(cuerpo);
  if (!parse.success) {
    return respuestaError(
      desdeZod(parse.error, { namespace: 'agendaOcultacion' }),
    );
  }

  // ── 4. Servicio ───────────────────────────────────────────────────────────
  const resultado = await ocultarActividad(cliente, contexto.valor.id, parse.data.eventoId);
  if (!resultado.ok) return respuestaError(resultado.error);

  // ── 5. Respuesta 200 con cuerpo ──────────────────────────────────────────
  return Response.json(
    { data: resultado.valor, advertencias: [] },
    { status: 200 },
  );
}
