/**
 * Slice `actividades` — creación de Actividad (Requisitos 4.1, 4.2, 4.3, 4.4,
 * 4.5, 4.11, 4.16, 5.2, 14.12).
 *
 * Lógica:
 * 1. Verificar rol: si `alumno` → `fallo('sin_permiso')` (Req 5.2 / 4.16).
 * 2. Normalizar horas (día completo → 00:00–23:59).
 * 3. Si `alcance === 'alumnos_seleccionados'`: verificar destinatarios en UNA
 *    sola query. Si el autor es profesor, verificar que son Alumnos_Asignados.
 * 4. INSERT en `agenda_eventos`.
 * 5. Si `alumnos_seleccionados`: INSERT en `agenda_evento_destinatarios`.
 * 6. Calcular advertencias contra las Entradas_Personales del editor.
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
  fallo,
  normalizarHora,
  ok,
  desdeErrorPostgrest,
  type Resultado,
} from '@/lib/agenda/compartido';

import {
  aEventoAgendaPropio,
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

import type { CrearActividad } from './esquemas';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Tipos ──────────────────────────────────────────────────────────────────

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
 * Crea una Actividad dirigida a alumnos. El rol `alumno` no tiene permiso.
 * El profesor solo puede dirigir la actividad a sus Alumnos_Asignados.
 */
export async function crearActividad(
  cliente: ServerClient,
  autor: AutorServicio,
  entrada: CrearActividad,
): Promise<Resultado<ResultadoCreacion>> {
  // ── 1. Verificar rol (Req 5.2 / 4.16) ────────────────────────────────────
  if (autor.rol === 'alumno') {
    return fallo(new ErrorAgenda('sin_permiso'));
  }

  // ── 2. Normalizar horas ───────────────────────────────────────────────────
  const diaCompleto = entrada.dia_completo ?? false;
  const horaInicio = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_inicio
    : normalizarHora(entrada.hora_inicio ?? RANGO_DIA_COMPLETO.hora_inicio);
  const horaFin = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_fin
    : normalizarHora(entrada.hora_fin ?? RANGO_DIA_COMPLETO.hora_fin);

  // ── 3. Verificar destinatarios (una sola query) ───────────────────────────
  if (entrada.alcance === 'alumnos_seleccionados') {
    const verificacion = await verificarDestinatarios(
      cliente,
      autor,
      entrada.destinatarios,
    );
    if (!verificacion.ok) return verificacion;
  }

  // ── 4. INSERT en agenda_eventos ───────────────────────────────────────────
  const { data: filaInsertada, error: errorInsert } = await cliente
    .from('agenda_eventos')
    .insert({
      creador_id: autor.id,
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

  // ── 5. INSERT destinatarios explícitos ────────────────────────────────────
  if (entrada.alcance === 'alumnos_seleccionados') {
    const filas = entrada.destinatarios.map((alumnoId) => ({
      evento_id: filaConAutor.id,
      alumno_id: alumnoId,
    }));

    const { error: errorDest } = await cliente
      .from('agenda_evento_destinatarios')
      .insert(filas);

    if (errorDest) {
      // Rollback: eliminar el evento recién creado
      await cliente.from('agenda_eventos').delete().eq('id', filaConAutor.id);
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
    { excluirId: filaConAutor.id, limite: LIMITE_ADVERTENCIAS },
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

  // Verificar que todos los destinatarios se encontraron como alumnos activos
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
