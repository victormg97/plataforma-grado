/**
 * Slice `actividades` — edición de Actividad (Requisitos 4.3, 4.5, 4.12, 4.14,
 * 4.15, 14.12, 14.13).
 *
 * Lógica:
 * 1. Leer evento existente. Si no existe o no es Actividad → `fallo('no_encontrado')`.
 * 2. Verificar permiso: Autor o Admin (Req 4.14); nadie más → `fallo('sin_permiso')`.
 * 3. UPDATE en `agenda_eventos` (sin cambiar `creador_id`).
 * 4. Si el alcance pasó a `todos_alumnos`: DELETE de destinatarios previos (Req 4.5).
 * 5. Si `alumnos_seleccionados`: DELETE previos + INSERT nuevos.
 * 6. Calcular advertencias.
 * 7. Devuelve `ok({ evento, advertencias })`.
 *
 * No crea registros en `asistencia` ni `pruebas` (Requisito 4.11).
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

import type { EditarActividad } from './esquemas';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Tipos ──────────────────────────────────────────────────────────────────

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
 * Edita una Actividad existente. Un Admin puede editar la Actividad de otro editor
 * con el mismo resultado observable (Req 4.14). Nadie más puede editarla (Req 4.15).
 */
export async function editarActividad(
  cliente: ServerClient,
  autor: AutorServicio,
  eventoId: string,
  entrada: EditarActividad,
): Promise<Resultado<ResultadoEdicion>> {
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

  // ── 3. Verificar destinatarios si es `alumnos_seleccionados` ──────────────
  if (entrada.alcance === 'alumnos_seleccionados') {
    const verificacion = await verificarDestinatarios(
      cliente,
      autor,
      entrada.destinatarios,
    );
    if (!verificacion.ok) return verificacion;
  }

  // ── 4. UPDATE sin cambiar creador_id (Req 14.13) ──────────────────────────
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
      alcance: entrada.alcance,
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

  // ── 5. Sincronizar destinatarios ──────────────────────────────────────────
  if (entrada.alcance === 'todos_alumnos') {
    // Req 4.5: eliminar todos los destinatarios previos
    await cliente
      .from('agenda_evento_destinatarios')
      .delete()
      .eq('evento_id', eventoId);
  } else {
    // alcance === 'alumnos_seleccionados': DELETE previos + INSERT nuevos
    await cliente
      .from('agenda_evento_destinatarios')
      .delete()
      .eq('evento_id', eventoId);

    const filas = entrada.destinatarios.map((alumnoId) => ({
      evento_id: eventoId,
      alumno_id: alumnoId,
    }));

    const { error: errorDest } = await cliente
      .from('agenda_evento_destinatarios')
      .insert(filas);

    if (errorDest) {
      return fallo(new ErrorAgenda('destinatarios_invalidos', { causa: errorDest }));
    }
  }

  // ── 6. Calcular advertencias contra elementos del editor ──────────────────
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

  // ── 7. Construir DTO ──────────────────────────────────────────────────────
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

// ─── Verificación de destinatarios ──────────────────────────────────────────

/**
 * Verifica que todos los destinatarios son alumnos activos, y si el autor es
 * profesor, que son sus Alumnos_Asignados. UNA sola query para todos a la vez.
 */
async function verificarDestinatarios(
  cliente: ServerClient,
  autor: AutorServicio,
  destinatarios: string[],
): Promise<Resultado<void>> {
  if (destinatarios.length === 0) {
    return fallo(new ErrorAgenda('destinatarios_invalidos'));
  }

  if (destinatarios.length > 200) {
    return fallo(new ErrorAgenda('destinatarios_invalidos'));
  }

  // Una sola query a profiles para verificar que todos existen y están activos
  const { data: perfiles, error } = await cliente
    .from('profiles')
    .select('id, rol, activo')
    .in('id', destinatarios)
    .eq('rol', 'alumno')
    .eq('activo', true);

  if (error) {
    return fallo(new ErrorAgenda('destinatarios_invalidos', { causa: error }));
  }

  const idsEncontrados = new Set((perfiles ?? []).map((p) => p.id));
  const todosExisten = destinatarios.every((id) => idsEncontrados.has(id));

  if (!todosExisten) {
    return fallo(new ErrorAgenda('destinatarios_invalidos'));
  }

  // Si el autor es profesor, verificar que todos son Alumnos_Asignados suyos
  if (autor.rol === 'profesor') {
    const { data: asignaciones, error: errorAsign } = await cliente
      .from('alumnos_extra')
      .select('alumno_id')
      .eq('profesor_id', autor.id)
      .in('alumno_id', destinatarios);

    if (errorAsign) {
      return fallo(new ErrorAgenda('alumno_no_asignado', { causa: errorAsign }));
    }

    const idsAsignados = new Set((asignaciones ?? []).map((a) => a.alumno_id));
    const todosAsignados = destinatarios.every((id) => idsAsignados.has(id));

    if (!todosAsignados) {
      return fallo(new ErrorAgenda('alumno_no_asignado'));
    }
  }

  return ok(undefined);
}
