/**
 * Ruta `GET /api/agenda/eventos` — lectura de eventos de agenda por rango.
 *
 * Punto de composición: orquesta los slices `visibilidad` (resolución de contexto y
 * proyección) y `nucleo` (lectura por rango). No contiene lógica de negocio propia
 * (Requisito 17.8, 17.11).
 *
 * El Filtro_Agenda NO se acepta como parámetro: el filtro es estado de presentación
 * que vive en el query param del cliente (Requisito 12.3).
 *
 * Máximo 4 queries por request:
 *  1–2. resolverContextoLector (perfil + vínculos, paralelas)
 *  3.   leerEventosEnRango (rango visible)
 *  4.   obtenerDestinatarioIds (condicional, solo si hay actividades de alcance
 *       'alumnos_seleccionados')
 *
 * Requisitos cubiertos: 4.7, 4.8, 4.9, 4.10, 5.6, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8,
 * 8.9, 8.10, 8.11, 12.1, 12.2, 12.11, 14.10, 14.11, 14.14, 17.11.
 */
import { createClient } from '@/lib/supabase/server';
import { ErrorAgenda, respuestaError } from '@/lib/agenda/compartido';
import { leerEventosEnRango, type RangoVisible, type FilaEventoConAutor } from '@/lib/agenda/nucleo';
import {
  resolverContextoLector,
  proyectarEventos,
  type EntradaProyeccion,
} from '@/lib/agenda/visibilidad';

// ── Constantes de validación ────────────────────────────────────────────────

/** Expresión regular para validar formato YYYY-MM-DD. */
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Máximo de días entre `desde` y `hasta` (dos meses completos). */
const MAXIMO_DIAS_RANGO = 62;

/** Milisegundos en un día. */
const MS_POR_DIA = 86_400_000;

// ── Handler GET ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');

  // ── 1. Validar rango (Req 12.11: 400 para rango ausente/mal formado/excedido) ─
  const validacion = validarRango(desde, hasta);
  if (!validacion.ok) return respuestaError(validacion.error);

  const rango: RangoVisible = { desde: validacion.desde, hasta: validacion.hasta };

  // ── 2. Cliente SSR ligado a la sesión (nunca Clave_Servicio, Req 14.14) ───
  const cliente = await createClient();

  // ── 3. Resolver contexto del lector (Req 14.10) → 401 sin sesión ──────────
  const contexto = await resolverContextoLector(cliente);
  if (!contexto.ok) return respuestaError(contexto.error);

  // ── 4. Leer eventos en rango (Req 12.11, una sola query) ──────────────────
  const filas = await leerEventosEnRango(cliente, rango);

  // ── 5. Obtener destinatarioIds para actividades de alumnos_seleccionados ──
  const destinatarioIdsPorEvento = await obtenerDestinatarioIds(
    cliente,
    filas,
    contexto.valor.id,
  );

  // ── 6. Proyectar (recorte de campos + descarte de no legibles, Req 8) ────
  const entradas: EntradaProyeccion[] = filas.map((fila) => ({
    fila,
    destinatarioIds: destinatarioIdsPorEvento.get(fila.id) ?? new Set(),
  }));

  const proyectados = proyectarEventos(entradas, contexto.valor);

  // ── 7. Respuesta 200 ─────────────────────────────────────────────────────
  return Response.json({ data: proyectados });
}

// ── Helpers privados ────────────────────────────────────────────────────────

/**
 * Valida que `desde` y `hasta` estén presentes, tengan formato YYYY-MM-DD,
 * `hasta >= desde` y que la diferencia no supere 62 días.
 */
function validarRango(
  desde: string | null,
  hasta: string | null,
): { ok: true; desde: string; hasta: string } | { ok: false; error: ErrorAgenda } {
  if (!desde || !hasta || !REGEX_FECHA.test(desde) || !REGEX_FECHA.test(hasta)) {
    return {
      ok: false,
      error: new ErrorAgenda('rango_invalido', { campo: 'desde,hasta' }),
    };
  }

  const dDesde = new Date(desde + 'T00:00:00Z');
  const dHasta = new Date(hasta + 'T00:00:00Z');

  if (isNaN(dDesde.getTime()) || isNaN(dHasta.getTime())) {
    return {
      ok: false,
      error: new ErrorAgenda('rango_invalido', { campo: 'desde,hasta' }),
    };
  }

  if (dHasta < dDesde) {
    return {
      ok: false,
      error: new ErrorAgenda('rango_invalido', { campo: 'desde,hasta' }),
    };
  }

  const diferenciaDias = Math.round(
    (dHasta.getTime() - dDesde.getTime()) / MS_POR_DIA,
  );

  if (diferenciaDias > MAXIMO_DIAS_RANGO) {
    return {
      ok: false,
      error: new ErrorAgenda('rango_invalido', { campo: 'desde,hasta' }),
    };
  }

  return { ok: true, desde, hasta };
}

/** Tipo del cliente Supabase SSR del proyecto. */
type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Para todas las filas con `alcance === 'alumnos_seleccionados'`, hace UNA SOLA
 * query a `agenda_evento_destinatarios` filtrando `evento_id in [...]` y
 * `alumno_id = lectorId`. Devuelve un `Map<string, Set<string>>`.
 *
 * Para filas con otros alcances no consulta nada: la Audiencia_Dinamica se resuelve
 * por RLS y la proyección no necesita la lista explícita.
 */
async function obtenerDestinatarioIds(
  cliente: ClienteSupabase,
  filas: FilaEventoConAutor[],
  lectorId: string,
): Promise<Map<string, Set<string>>> {
  const mapa = new Map<string, Set<string>>();

  // Filtrar solo los eventos que son actividades con alcance seleccionado
  const eventoIds = filas
    .filter((f) => f.alcance === 'alumnos_seleccionados')
    .map((f) => f.id);

  if (eventoIds.length === 0) return mapa;

  // Una sola query: traer solo las filas donde el lector es destinatario
  const { data } = await cliente
    .from('agenda_evento_destinatarios')
    .select('evento_id, alumno_id')
    .in('evento_id', eventoIds)
    .eq('alumno_id', lectorId);

  if (!data) return mapa;

  for (const row of data) {
    const set = mapa.get(row.evento_id);
    if (set) {
      set.add(row.alumno_id);
    } else {
      mapa.set(row.evento_id, new Set([row.alumno_id]));
    }
  }

  return mapa;
}
