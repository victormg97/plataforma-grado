/**
 * Slice `entradas-personales` — creación de Entrada_Personal (Requisitos 3.1, 3.2,
 * 5.1, 5.2, 6.2, 6.7, 6.9, 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 8.2, 10.3, 10.10).
 *
 * Dos caminos internos según el rol:
 *
 * - **Alumno**: invoca el RPC `agenda_guardar_entrada_personal_alumno` que garantiza
 *   la atomicidad del bloqueo de solapamiento (Requisito 6.9). Un `PT409` se traduce
 *   a `ConflictoSolapamiento` con hasta 10 conflictos.
 *
 * - **Editor (profesor | admin)**: INSERT directo + cálculo de advertencias con
 *   `recolectarElementosEditor`. El editor **siempre persiste**: nunca devuelve un
 *   error por solapamiento (Requisitos 7.2, 7.5, 7.7).
 *
 * Devuelve `Resultado` en lugar de lanzar. El route handler decide el HTTP status.
 *
 * Dependencias: `compartido` (nivel 0), `nucleo` (nivel 0), `solapamiento` (nivel 1).
 * No importa ningún otro slice de capacidad (Requisito 17.5).
 */
import {
  ErrorAgenda,
  RANGO_DIA_COMPLETO,
  desdeErrorPostgrest,
  fallo,
  normalizarHora,
  ok,
  type Resultado,
} from '@/lib/agenda/compartido';

import {
  aEventoAgendaPropio,
  type AdvertenciaSolapamiento,
  type AutorResumen,
  type EventoAgendaPropio,
  type FilaEventoConAutor,
} from '@/lib/agenda/nucleo';

import {
  LIMITE_ADVERTENCIAS,
  evaluarSolapamiento,
  recolectarElementosEditor,
  type ElementoTemporal,
} from '@/lib/agenda/solapamiento';

import type { UserRol } from '@/lib/supabase/types';
import type { createClient } from '@/lib/supabase/server';

import type { CrearEntradaPersonal } from './esquemas';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Tipos de entrada ───────────────────────────────────────────────────────

interface AutorServicio {
  id: string;
  rol: UserRol;
}

interface ResultadoCreacion {
  evento: EventoAgendaPropio;
  advertencias: AdvertenciaSolapamiento[];
}

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Crea una Entrada_Personal. El camino del alumno bloquea en el RPC si hay
 * solapamiento con Compromisos_Asignados; el del editor siempre persiste y devuelve
 * advertencias informativas.
 */
export async function crearEntradaPersonal(
  cliente: ServerClient,
  autor: AutorServicio,
  entrada: CrearEntradaPersonal,
): Promise<Resultado<ResultadoCreacion>> {
  if (autor.rol === 'alumno') {
    return caminoAlumno(cliente, autor, entrada);
  }

  return caminoEditor(cliente, autor, entrada);
}

// ─── Camino del alumno ──────────────────────────────────────────────────────

async function caminoAlumno(
  cliente: ServerClient,
  autor: AutorServicio,
  entrada: CrearEntradaPersonal,
): Promise<Resultado<ResultadoCreacion>> {
  const diaCompleto = entrada.dia_completo ?? false;
  const horaInicio = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_inicio
    : normalizarHora(entrada.hora_inicio ?? RANGO_DIA_COMPLETO.hora_inicio);
  const horaFin = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_fin
    : normalizarHora(entrada.hora_fin ?? RANGO_DIA_COMPLETO.hora_fin);

  const { data, error } = await cliente.rpc('agenda_guardar_entrada_personal_alumno', {
    p_evento_id: null,
    p_titulo: entrada.titulo,
    p_fecha: entrada.fecha,
    p_hora_inicio: horaInicio,
    p_hora_fin: horaFin,
    p_categoria: entrada.categoria,
    p_visibilidad: entrada.visibilidad,
    p_dia_completo: diaCompleto,
    p_descripcion: entrada.descripcion ?? null,
    p_nota: entrada.nota ?? null,
    p_lugar: entrada.lugar ?? null,
    p_enlace_conexion: entrada.enlace_conexion ?? null,
  });

  if (error) {
    const errorAgenda = desdeErrorPostgrest(error);
    if (errorAgenda) return fallo(errorAgenda);
    // Error inesperado de DB — no es un SQLSTATE conocido de la agenda.
    return fallo(new ErrorAgenda('rango_invalido', { causa: error }));
  }

  // El RPC devuelve un JSON con `{ evento, advertencias }`.
  const respuestaRpc = data as unknown as {
    evento: FilaEventoConAutor;
    advertencias: AdvertenciaSolapamiento[];
  };

  const contexto = {
    autor: respuestaRpc.evento.autor as AutorResumen,
    puede_editar: true,
    oculto: false,
  };

  const evento = aEventoAgendaPropio(
    respuestaRpc.evento as unknown as Parameters<typeof aEventoAgendaPropio>[0],
    contexto,
  );

  return ok({ evento, advertencias: respuestaRpc.advertencias ?? [] });
}

// ─── Camino del editor ──────────────────────────────────────────────────────

async function caminoEditor(
  cliente: ServerClient,
  autor: AutorServicio,
  entrada: CrearEntradaPersonal,
): Promise<Resultado<ResultadoCreacion>> {
  const diaCompleto = entrada.dia_completo ?? false;
  const horaInicio = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_inicio
    : normalizarHora(entrada.hora_inicio ?? RANGO_DIA_COMPLETO.hora_inicio);
  const horaFin = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_fin
    : normalizarHora(entrada.hora_fin ?? RANGO_DIA_COMPLETO.hora_fin);

  // ── 1. INSERT directo ─────────────────────────────────────────────────────
  const { data: filaInsertada, error: errorInsert } = await cliente
    .from('agenda_eventos')
    .insert({
      creador_id: autor.id,
      alcance: 'personal' as const,
      titulo: entrada.titulo.trim(),
      fecha: entrada.fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      dia_completo: diaCompleto,
      categoria: entrada.categoria,
      visibilidad: entrada.visibilidad,
      descripcion: entrada.descripcion ?? null,
      nota: entrada.nota ?? null,
      lugar: entrada.lugar ?? null,
      enlace_conexion: entrada.enlace_conexion ?? null,
    })
    .select(`
      id, creador_id, titulo, descripcion, nota, categoria, alcance, visibilidad,
      fecha, hora_inicio, hora_fin, dia_completo, lugar, enlace_conexion, activo,
      created_at, updated_at,
      autor:profiles!agenda_eventos_creador_id_fkey(id, nombre, apellido, rol)
    `)
    .single();

  if (errorInsert || !filaInsertada) {
    const errorAgenda = desdeErrorPostgrest(errorInsert);
    return fallo(errorAgenda ?? new ErrorAgenda('rango_invalido', { causa: errorInsert }));
  }

  const filaConAutor = filaInsertada as unknown as FilaEventoConAutor;

  // ── 2. Calcular advertencias ──────────────────────────────────────────────
  const elementos = await recolectarElementosEditor(cliente, autor.id, entrada.fecha);

  const candidato: ElementoTemporal = {
    id: filaConAutor.id,
    fecha: entrada.fecha,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    dia_completo: diaCompleto,
  };

  const conflictos = evaluarSolapamiento(candidato, elementos, {
    excluirId: filaConAutor.id,
    limite: LIMITE_ADVERTENCIAS,
  });

  // Mapear a AdvertenciaSolapamiento (ya lo son por forma del recolector)
  const advertencias: AdvertenciaSolapamiento[] = conflictos;

  // ── 3. Construir el DTO ───────────────────────────────────────────────────
  const contexto = {
    autor: filaConAutor.autor,
    puede_editar: true,
    oculto: false,
  };

  const evento = aEventoAgendaPropio(
    filaConAutor as unknown as Parameters<typeof aEventoAgendaPropio>[0],
    contexto,
  );

  return ok({ evento, advertencias });
}
