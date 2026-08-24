/**
 * Slice `entradas-personales` — edición de Entrada_Personal (Requisitos 3.6, 3.7,
 * 5.4, 5.5, 6.5, 10.13, 14.13).
 *
 * Dos caminos internos según el rol:
 *
 * - **Alumno**: invoca el RPC `agenda_guardar_entrada_personal_alumno` con
 *   `p_evento_id` no nulo. El RPC se encarga de la exclusión del propio evento
 *   (Requisito 6.5), de conservar `alcance = 'personal'` (Requisito 14.13) y de
 *   verificar autoría.
 *
 * - **Editor (profesor | admin)**: verifica autoría manualmente (Admin **no** puede
 *   editar una Entrada_Personal ajena, Requisito 3.7), hace `UPDATE` conservando
 *   `creador_id` y `alcance`, y calcula advertencias con `excluirId` (Requisito 6.5).
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
  leerEventoPorId,
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

import type { EditarEntradaPersonal } from './esquemas';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Tipos de entrada ───────────────────────────────────────────────────────

interface AutorServicio {
  id: string;
  rol: UserRol;
}

interface ResultadoEdicion {
  evento: EventoAgendaPropio;
  advertencias: AdvertenciaSolapamiento[];
}

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Edita una Entrada_Personal existente. Conserva el alcance `personal` y el Autor
 * originales, actualiza la fecha de actualización y excluye el propio evento de la
 * evaluación de solapamiento (Requisito 6.5).
 */
export async function editarEntradaPersonal(
  cliente: ServerClient,
  autor: AutorServicio,
  eventoId: string,
  entrada: EditarEntradaPersonal,
): Promise<Resultado<ResultadoEdicion>> {
  if (autor.rol === 'alumno') {
    return caminoAlumno(cliente, autor, eventoId, entrada);
  }

  return caminoEditor(cliente, autor, eventoId, entrada);
}

// ─── Camino del alumno ──────────────────────────────────────────────────────

async function caminoAlumno(
  cliente: ServerClient,
  autor: AutorServicio,
  eventoId: string,
  entrada: EditarEntradaPersonal,
): Promise<Resultado<ResultadoEdicion>> {
  const diaCompleto = entrada.dia_completo ?? false;
  const horaInicio = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_inicio
    : normalizarHora(entrada.hora_inicio ?? RANGO_DIA_COMPLETO.hora_inicio);
  const horaFin = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_fin
    : normalizarHora(entrada.hora_fin ?? RANGO_DIA_COMPLETO.hora_fin);

  const { data, error } = await cliente.rpc('agenda_guardar_entrada_personal_alumno', {
    p_evento_id: eventoId,
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
  eventoId: string,
  entrada: EditarEntradaPersonal,
): Promise<Resultado<ResultadoEdicion>> {
  // ── 1. Verificar existencia y autoría ─────────────────────────────────────
  const existente = await leerEventoPorId(cliente, eventoId);

  if (!existente) {
    return fallo(new ErrorAgenda('no_encontrado'));
  }

  // Requisito 3.7: un Admin NO puede editar una Entrada_Personal ajena.
  if (existente.creador_id !== autor.id) {
    return fallo(new ErrorAgenda('sin_permiso'));
  }

  // Verificar que es efectivamente una Entrada_Personal (alcance = 'personal').
  if (existente.alcance !== 'personal') {
    return fallo(new ErrorAgenda('no_encontrado'));
  }

  // ── 2. UPDATE sin cambiar creador_id ni alcance (Requisitos 3.6, 14.13) ───
  const diaCompleto = entrada.dia_completo ?? false;
  const horaInicio = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_inicio
    : normalizarHora(entrada.hora_inicio ?? RANGO_DIA_COMPLETO.hora_inicio);
  const horaFin = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_fin
    : normalizarHora(entrada.hora_fin ?? RANGO_DIA_COMPLETO.hora_fin);

  const { data: filaActualizada, error: errorUpdate } = await cliente
    .from('agenda_eventos')
    .update({
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
    .eq('id', eventoId)
    .eq('activo', true)
    .select(`
      id, creador_id, titulo, descripcion, nota, categoria, alcance, visibilidad,
      fecha, hora_inicio, hora_fin, dia_completo, lugar, enlace_conexion, activo,
      created_at, updated_at,
      autor:profiles!agenda_eventos_creador_id_fkey(id, nombre, apellido, rol)
    `)
    .single();

  if (errorUpdate || !filaActualizada) {
    const errorAgenda = desdeErrorPostgrest(errorUpdate);
    return fallo(errorAgenda ?? new ErrorAgenda('no_encontrado'));
  }

  const filaConAutor = filaActualizada as unknown as FilaEventoConAutor;

  // ── 3. Calcular advertencias con exclusión del propio evento (Req 6.5) ────
  const elementos = await recolectarElementosEditor(cliente, autor.id, entrada.fecha);

  const candidato: ElementoTemporal = {
    id: filaConAutor.id,
    fecha: entrada.fecha,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    dia_completo: diaCompleto,
  };

  const advertencias: AdvertenciaSolapamiento[] = evaluarSolapamiento(
    candidato,
    elementos,
    { excluirId: eventoId, limite: LIMITE_ADVERTENCIAS },
  );

  // ── 4. Construir el DTO ───────────────────────────────────────────────────
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
