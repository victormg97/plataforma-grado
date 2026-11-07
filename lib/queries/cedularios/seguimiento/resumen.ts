/**
 * Summary queries of the per-student cedulario tracking (phase 2).
 *
 * Plain async functions that receive a Supabase client, so they run in the browser (React Query
 * hooks) or on the server. They throw the raw Supabase error so callers can wrap them with
 * `consultar`. Row-level security decides which rows are visible.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { SEG_BUSQUEDA_MAX } from '@/lib/cedularios/seguimiento/constants';

type Client = SupabaseClient<Database>;
type Functions = Database['public']['Functions'];
type ResumenAlumnoFila = Functions['get_alumno_cedularios_resumen']['Returns'][number];
type AlumnoCedularioFila = Functions['get_cedulario_alumnos_resumen']['Returns'][number];

/** Page size of the students list of a cedulario. */
export const ALUMNOS_CEDULARIO_PAGINA = 50;

/** Student data shown in the hover card, the record and the reviewer header. */
export interface AlumnoResumen {
  id: string;
  nombre: string;
  apellido: string;
  apellidoMaterno: string | null;
  email: string;
  avatarUrl: string | null;
  activo: boolean;
}

/** One assignment of a student to a cedulario, with its progress totals. */
export interface AsignacionResumen {
  asignacionId: string;
  cedularioId: string;
  cedularioNombre: string;
  cedularioVersion: string | null;
  cedularioActivo: boolean;
  universidadId: string | null;
  universidadNombre: string | null;
  estado: 'activa' | 'desasignada';
  asignadoAt: string;
  desasignadoAt: string | null;
  totalAsignadas: number;
  totalCubiertas: number;
  /** Rounded percentage from the server, or null when the assignment has no active materia. */
  porcentaje: number | null;
  ultimaActividad: string | null;
}

/** Result of `fetchResumenAlumno`. */
export interface ResumenAlumno {
  alumno: AlumnoResumen;
  /** The server allows the current user to write the tracking of this student. */
  puedeEditar: boolean;
  /** Can write and the student is active (an inactive student cannot receive assignments). */
  puedeAsignar: boolean;
  asignaciones: AsignacionResumen[];
}

/** One student of a cedulario with the progress of their active assignment. */
export interface AlumnoDeCedulario {
  asignacionId: string;
  alumnoId: string;
  nombre: string;
  apellido: string;
  apellidoMaterno: string | null;
  email: string;
  avatarUrl: string | null;
  alumnoActivo: boolean;
  asignadoAt: string;
  ultimaActividad: string | null;
  totalAsignadas: number;
  totalCubiertas: number;
  porcentaje: number | null;
  puedeEditar: boolean;
}

/** One page of students of a cedulario. */
export interface PaginaAlumnosCedulario {
  filas: AlumnoDeCedulario[];
  /** Total rows matching the search, across all pages. */
  total: number;
  offset: number;
}

function aAsignacion(fila: ResumenAlumnoFila): AsignacionResumen | null {
  // A student without assignments comes back as one row with the assignment columns null.
  if (fila.asignacion_id === null || fila.cedulario_id === null) return null;
  return {
    asignacionId: fila.asignacion_id,
    cedularioId: fila.cedulario_id,
    cedularioNombre: fila.cedulario_nombre ?? '',
    cedularioVersion: fila.cedulario_version,
    cedularioActivo: fila.cedulario_activo ?? false,
    universidadId: fila.universidad_id,
    universidadNombre: fila.universidad_nombre,
    estado: fila.estado === 'desasignada' ? 'desasignada' : 'activa',
    asignadoAt: fila.asignado_at ?? '',
    desasignadoAt: fila.desasignado_at,
    totalAsignadas: fila.total_asignadas ?? 0,
    totalCubiertas: fila.total_cubiertas ?? 0,
    porcentaje: fila.porcentaje,
    ultimaActividad: fila.ultima_actividad,
  };
}

/**
 * Cedulario summary of one student, or `null` when the student is not visible to the current
 * user or does not have the alumno role (the RPC returns zero rows).
 */
export async function fetchResumenAlumno(
  client: Client,
  alumnoId: string,
  incluirDesasignadas = false,
): Promise<ResumenAlumno | null> {
  const { data, error } = await client.rpc('get_alumno_cedularios_resumen', {
    p_alumno_id: alumnoId,
    p_incluir_desasignadas: incluirDesasignadas,
  });

  if (error) throw error;

  const filas = data ?? [];
  const primera = filas[0];
  if (!primera) return null;

  const asignaciones: AsignacionResumen[] = [];
  for (const fila of filas) {
    const asignacion = aAsignacion(fila);
    if (asignacion) asignaciones.push(asignacion);
  }

  return {
    alumno: {
      id: primera.alumno_id,
      nombre: primera.alumno_nombre,
      apellido: primera.alumno_apellido,
      apellidoMaterno: primera.alumno_apellido_materno,
      email: primera.alumno_email,
      avatarUrl: primera.alumno_avatar_url,
      activo: primera.alumno_activo,
    },
    puedeEditar: primera.puede_editar,
    puedeAsignar: primera.puede_editar && primera.alumno_activo,
    asignaciones,
  };
}

function aAlumnoDeCedulario(fila: AlumnoCedularioFila): AlumnoDeCedulario {
  return {
    asignacionId: fila.asignacion_id,
    alumnoId: fila.alumno_id,
    nombre: fila.nombre,
    apellido: fila.apellido,
    apellidoMaterno: fila.apellido_materno,
    email: fila.email,
    avatarUrl: fila.avatar_url,
    alumnoActivo: fila.alumno_activo,
    asignadoAt: fila.asignado_at,
    ultimaActividad: fila.ultima_actividad,
    totalAsignadas: fila.total_asignadas,
    totalCubiertas: fila.total_cubiertas,
    porcentaje: fila.porcentaje,
    puedeEditar: fila.puede_editar,
  };
}

/**
 * One page (50 rows) of the students with an active assignment to a cedulario, ordered by
 * surname and name. An empty or blank `q` means no search filter.
 */
export async function fetchAlumnosDeCedulario(
  client: Client,
  cedularioId: string,
  q: string,
  offset: number,
): Promise<PaginaAlumnosCedulario> {
  const consulta = q.trim().slice(0, SEG_BUSQUEDA_MAX);

  const { data, error } = await client.rpc('get_cedulario_alumnos_resumen', {
    p_cedulario_id: cedularioId,
    p_q: consulta === '' ? null : consulta,
    p_limit: ALUMNOS_CEDULARIO_PAGINA,
    p_offset: offset,
  });

  if (error) throw error;

  const filas = data ?? [];
  const primera = filas[0];
  return {
    filas: filas.map(aAlumnoDeCedulario),
    total: primera ? Number(primera.total_filas) : 0,
    offset,
  };
}
