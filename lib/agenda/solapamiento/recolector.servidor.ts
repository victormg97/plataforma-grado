/**
 * Slice `solapamiento` — recolección de elementos para la evaluación de solapamiento.
 *
 * Funciones de servidor que reciben un cliente Supabase tipado y devuelven los
 * elementos contra los cuales se evalúa un candidato:
 *
 * - `recolectarCompromisosAlumno`: Clases activas no canceladas + Actividades recibidas
 *   (incluidas las ocultas, Requisito 9.10).
 * - `recolectarElementosEditor`: Clases del editor no canceladas + Bloqueos_Horario
 *   activos + Entradas_Personales activas del editor.
 *
 * Dependencias permitidas: `compartido` (nivel 0), `nucleo` (nivel 0), propios del slice.
 * No persiste nada — solo lectura.
 */
import { normalizarHora } from '@/lib/agenda/compartido';
import type { AdvertenciaSolapamiento } from '@/lib/agenda/nucleo';
import type { createClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Recolecta los Compromisos_Asignados de un alumno en una fecha dada:
 * - Clases activas (`horarios.activo = true`) cuyo estado en `asistencia` no es `cancelado`.
 * - Actividades activas que el alumno recibe (Destinatario_Explicito o Audiencia_Dinamica),
 *   **incluidas las ocultas** (Requisito 9.10).
 *
 * Estrategia de queries (minimiza idas y vueltas):
 * 1. Clases: join `horarios` + `asistencia`, filtro por fecha y estado != cancelado.
 * 2. Actividades `alumnos_seleccionados`: join `agenda_evento_destinatarios`.
 * 3. Actividades `todos_alumnos`: filtradas en memoria por Audiencia_Dinamica.
 *
 * Las tres queries corren en paralelo.
 */
export async function recolectarCompromisosAlumno(
  cliente: ServerClient,
  alumnoId: string,
  fecha: string,
): Promise<AdvertenciaSolapamiento[]> {
  const [clasesRes, actSelRes, actTodosRes] = await Promise.all([
    // ── Clases activas no canceladas del alumno en esa fecha ──────────────
    cliente
      .from('horarios')
      .select('id, titulo, fecha, hora_inicio, hora_fin, asistencia!inner(estado)')
      .eq('alumno_id', alumnoId)
      .eq('activo', true)
      .eq('fecha', fecha)
      .neq('asistencia.estado', 'cancelado'),

    // ── Actividades alcance `alumnos_seleccionados` con el alumno como destinatario ──
    cliente
      .from('agenda_evento_destinatarios')
      .select(`
        evento:agenda_eventos!inner(
          id, titulo, fecha, hora_inicio, hora_fin, dia_completo, activo
        )
      `)
      .eq('alumno_id', alumnoId)
      .eq('agenda_eventos.activo', true)
      .eq('agenda_eventos.fecha', fecha),

    // ── Actividades alcance `todos_alumnos` de esa fecha ─────────────────
    // Filtro de Audiencia_Dinamica se aplica en memoria (set acotado por fecha).
    cliente
      .from('agenda_eventos')
      .select('id, titulo, fecha, hora_inicio, hora_fin, dia_completo, creador_id, profiles!agenda_eventos_creador_id_fkey(rol)')
      .eq('activo', true)
      .eq('fecha', fecha)
      .eq('alcance', 'todos_alumnos'),
  ]);

  const elementos: AdvertenciaSolapamiento[] = [];

  // ── Mapeo de clases ──────────────────────────────────────────────────────
  if (clasesRes.data) {
    for (const clase of clasesRes.data) {
      elementos.push({
        tipo: 'clase',
        id: clase.id,
        titulo: clase.titulo,
        fecha: clase.fecha,
        hora_inicio: normalizarHora(clase.hora_inicio),
        hora_fin: normalizarHora(clase.hora_fin),
      });
    }
  }

  // ── Actividades de alcance `alumnos_seleccionados` ───────────────────────
  if (actSelRes.data) {
    for (const row of actSelRes.data) {
      const ev = row.evento as unknown as {
        id: string;
        titulo: string;
        fecha: string;
        hora_inicio: string;
        hora_fin: string;
        dia_completo: boolean;
        activo: boolean;
      } | null;
      if (!ev) continue;
      elementos.push({
        tipo: 'actividad',
        id: ev.id,
        titulo: ev.titulo,
        fecha: ev.fecha,
        hora_inicio: normalizarHora(ev.hora_inicio),
        hora_fin: normalizarHora(ev.hora_fin),
      });
    }
  }

  // ── Actividades de alcance `todos_alumnos` (Audiencia_Dinamica) ──────────
  // El alumno recibe la actividad si:
  //   - Creador es admin: todos los alumnos activos la reciben.
  //   - Creador es profesor: solo sus Alumnos_Asignados la reciben.
  // Verificamos la asignación del alumno si el creador es profesor.
  if (actTodosRes.data && actTodosRes.data.length > 0) {
    // Recolectar profesor_ids únicos para verificar asignación
    const profesorIds = actTodosRes.data
      .filter((ev) => {
        const profile = ev.profiles as unknown as { rol: string } | null;
        return profile?.rol === 'profesor';
      })
      .map((ev) => ev.creador_id);

    // Una sola query para verificar asignaciones del alumno con esos profesores
    let asignaciones: Set<string> = new Set();
    if (profesorIds.length > 0) {
      const { data: asignacionesData } = await cliente
        .from('alumnos_extra')
        .select('profesor_id')
        .eq('alumno_id', alumnoId)
        .in('profesor_id', [...new Set(profesorIds)]);

      if (asignacionesData) {
        asignaciones = new Set(
          asignacionesData
            .filter((a): a is { profesor_id: string } => a.profesor_id !== null)
            .map((a) => a.profesor_id),
        );
      }
    }

    for (const ev of actTodosRes.data) {
      const profile = ev.profiles as unknown as { rol: string } | null;
      const rolCreador = profile?.rol;

      // Audiencia_Dinamica: admin -> todos; profesor -> solo sus asignados
      const recibeActividad =
        rolCreador === 'admin' ||
        (rolCreador === 'profesor' && asignaciones.has(ev.creador_id));

      if (recibeActividad) {
        elementos.push({
          tipo: 'actividad',
          id: ev.id,
          titulo: ev.titulo,
          fecha: ev.fecha,
          hora_inicio: normalizarHora(ev.hora_inicio),
          hora_fin: normalizarHora(ev.hora_fin),
        });
      }
    }
  }

  return elementos;
}

/**
 * Recolecta los elementos del editor (profesor o admin) en una fecha dada:
 * - Clases activas no canceladas donde el editor es `profesor_id`.
 * - Bloqueos_Horario activos del editor.
 * - Entradas_Personales activas del editor (alcance = 'personal').
 *
 * Tres queries paralelas (Requisitos 7.1, 7.4).
 */
export async function recolectarElementosEditor(
  cliente: ServerClient,
  editorId: string,
  fecha: string,
): Promise<AdvertenciaSolapamiento[]> {
  const [clasesRes, bloqueosRes, entradasRes] = await Promise.all([
    // ── Clases activas no canceladas del editor ──────────────────────────
    cliente
      .from('horarios')
      .select('id, titulo, fecha, hora_inicio, hora_fin, asistencia!inner(estado)')
      .eq('profesor_id', editorId)
      .eq('activo', true)
      .eq('fecha', fecha)
      .neq('asistencia.estado', 'cancelado'),

    // ── Bloqueos_Horario activos del editor ──────────────────────────────
    cliente
      .from('bloqueos_horario')
      .select('id, motivo, fecha, hora_inicio, hora_fin')
      .eq('profesor_id', editorId)
      .eq('activo', true)
      .eq('fecha', fecha),

    // ── Entradas_Personales activas del editor ───────────────────────────
    cliente
      .from('agenda_eventos')
      .select('id, titulo, fecha, hora_inicio, hora_fin, dia_completo')
      .eq('creador_id', editorId)
      .eq('activo', true)
      .eq('fecha', fecha)
      .eq('alcance', 'personal'),
  ]);

  const elementos: AdvertenciaSolapamiento[] = [];

  // ── Mapeo de clases ──────────────────────────────────────────────────────
  if (clasesRes.data) {
    for (const clase of clasesRes.data) {
      elementos.push({
        tipo: 'clase',
        id: clase.id,
        titulo: clase.titulo,
        fecha: clase.fecha,
        hora_inicio: normalizarHora(clase.hora_inicio),
        hora_fin: normalizarHora(clase.hora_fin),
      });
    }
  }

  // ── Mapeo de bloqueos ────────────────────────────────────────────────────
  if (bloqueosRes.data) {
    for (const bloqueo of bloqueosRes.data) {
      elementos.push({
        tipo: 'bloqueo_horario',
        id: bloqueo.id,
        titulo: bloqueo.motivo ?? '',
        fecha: bloqueo.fecha,
        hora_inicio: normalizarHora(bloqueo.hora_inicio),
        hora_fin: normalizarHora(bloqueo.hora_fin),
      });
    }
  }

  // ── Mapeo de entradas personales ─────────────────────────────────────────
  if (entradasRes.data) {
    for (const entrada of entradasRes.data) {
      elementos.push({
        tipo: 'entrada_personal',
        id: entrada.id,
        titulo: entrada.titulo,
        fecha: entrada.fecha,
        hora_inicio: normalizarHora(entrada.hora_inicio),
        hora_fin: normalizarHora(entrada.hora_fin),
      });
    }
  }

  return elementos;
}
