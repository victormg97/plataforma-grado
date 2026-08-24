/**
 * Destinatarios — Requisitos 4.4, 4.7, 4.8, 4.9, 13.4
 *
 * Resuelve la lista de DestinatarioVigente de una Actividad en UNA
 * sola consulta (sin N+1), según el alcance y el rol del autor.
 *
 * Se invoca una única vez en el momento de la creación/edición
 * (Requisito 13.4: la audiencia se congela para la notificación).
 */

import type { createClient } from '@/lib/supabase/server';
import type { UserRol } from '@/lib/supabase/types';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface DestinatarioVigente {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  idioma: string; // 'es' | 'en'
}

// ─── Entrada ────────────────────────────────────────────────────────────────

interface ActividadParaDestinatarios {
  id: string;
  alcance: 'alumnos_seleccionados' | 'todos_alumnos';
  autorId: string;
  autorRol: UserRol;
}

// ─── Idioma por defecto ─────────────────────────────────────────────────────

const IDIOMA_DEFAULT = 'es';

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Resuelve los destinatarios vigentes de una Actividad.
 *
 * - `alumnos_seleccionados`: query a `agenda_evento_destinatarios` con join a
 *   `profiles` filtrando `activo = true`.
 * - `todos_alumnos` + admin: query a `profiles` con `rol = alumno` y `activo`.
 * - `todos_alumnos` + profesor: query a `alumnos_extra` con join a `profiles`,
 *   filtrando `profesor_id = autorId` y perfil activo con rol alumno.
 *
 * Una sola query por caso, sin bucles.
 */
export async function resolverDestinatariosVigentes(
  cliente: ServerClient,
  actividad: ActividadParaDestinatarios,
): Promise<DestinatarioVigente[]> {
  if (actividad.alcance === 'alumnos_seleccionados') {
    return resolverExplicitos(cliente, actividad.id);
  }

  // alcance === 'todos_alumnos'
  if (actividad.autorRol === 'admin') {
    return resolverTodosAlumnosAdmin(cliente);
  }

  return resolverAlumnosAsignadosProfesor(cliente, actividad.autorId);
}

// ─── Queries individuales ───────────────────────────────────────────────────

/**
 * Destinatario_Explicito: join de agenda_evento_destinatarios con profiles.
 * Requisito 4.9: la fila de destinatarios sobrevive a la pérdida del vínculo.
 */
async function resolverExplicitos(
  cliente: ServerClient,
  eventoId: string,
): Promise<DestinatarioVigente[]> {
  const { data, error } = await cliente
    .from('agenda_evento_destinatarios')
    .select('alumno_id, profiles!agenda_evento_destinatarios_alumno_id_fkey(id, nombre, apellido, email, idioma, activo)')
    .eq('evento_id', eventoId);

  if (error) throw error;
  if (!data) return [];

  return data
    .filter((row) => {
      const p = row.profiles;
      return p && p.activo;
    })
    .map((row) => {
      const p = row.profiles!;
      return {
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        email: p.email ?? null,
        idioma: p.idioma ?? IDIOMA_DEFAULT,
      };
    });
}

/**
 * Audiencia_Dinamica para admin: todos los alumnos activos del tenant.
 * Requisito 4.8.
 */
async function resolverTodosAlumnosAdmin(
  cliente: ServerClient,
): Promise<DestinatarioVigente[]> {
  const { data, error } = await cliente
    .from('profiles')
    .select('id, nombre, apellido, email, idioma')
    .eq('rol', 'alumno')
    .eq('activo', true);

  if (error) throw error;
  if (!data) return [];

  return data.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    apellido: p.apellido,
    email: p.email ?? null,
    idioma: p.idioma ?? IDIOMA_DEFAULT,
  }));
}

/**
 * Audiencia_Dinamica para profesor: sus Alumnos_Asignados activos.
 * Requisitos 4.8, 4.7.
 */
async function resolverAlumnosAsignadosProfesor(
  cliente: ServerClient,
  profesorId: string,
): Promise<DestinatarioVigente[]> {
  const { data, error } = await cliente
    .from('alumnos_extra')
    .select('alumno_id, profiles!alumnos_extra_alumno_id_fkey(id, nombre, apellido, email, idioma, activo, rol)')
    .eq('profesor_id', profesorId);

  if (error) throw error;
  if (!data) return [];

  return data
    .filter((row) => {
      const p = row.profiles;
      return p && p.activo && p.rol === 'alumno';
    })
    .map((row) => {
      const p = row.profiles!;
      return {
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        email: p.email ?? null,
        idioma: p.idioma ?? IDIOMA_DEFAULT,
      };
    });
}
