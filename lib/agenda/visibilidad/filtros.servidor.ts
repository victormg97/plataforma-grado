/**
 * Slice `visibilidad` — funciones de SERVIDOR que necesitan el cliente Supabase
 * (Requisitos 14.10, 14.12).
 *
 * `resolverContextoLector` obtiene el usuario autenticado y construye el
 * `ContextoLector` con dos consultas paralelas (perfil + vínculos), minimizando la
 * latencia sin sacrificar tipado.
 *
 * `filtroPorRol` devuelve un predicado que la ruta de API puede usar para añadir
 * condiciones al `SELECT` de agenda_eventos por encima de RLS.
 *
 * Dependencias: `@/lib/supabase/server` (cliente SSR), `@/lib/agenda/compartido`
 * (errores y resultado), `./matriz` (tipo ContextoLector).
 */
import { createClient } from '@/lib/supabase/server';
import { ErrorAgenda, fallo, ok, type Resultado } from '@/lib/agenda/compartido';
import type { UserRol } from '@/lib/supabase/types';

import type { ContextoLector } from './matriz';

/** Tipo del cliente Supabase SSR del proyecto. */
type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Construye el `ContextoLector` a partir de la sesión actual (Requisito 14.10).
 *
 * Dos consultas paralelas:
 *  1. `profiles` por id → rol y estado activo.
 *  2. `alumnos_extra` filtrado por `profesor_id = uid OR alumno_id = uid` →
 *     construye `alumnosAsignados` (para Profesor) y `profesores` (para Alumno).
 *
 * Devuelve `fallo('sin_sesion')` si no hay usuario o si el perfil está inactivo.
 */
export async function resolverContextoLector(
  cliente: ClienteSupabase,
): Promise<Resultado<ContextoLector>> {
  // ── Obtener sesión ────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await cliente.auth.getUser();

  if (!user) {
    return fallo(new ErrorAgenda('sin_sesion'));
  }

  const uid = user.id;

  // ── Dos consultas paralelas: perfil + vínculos ────────────────────────────
  const [perfilRes, vinculosRes] = await Promise.all([
    cliente
      .from('profiles')
      .select('rol, activo')
      .eq('id', uid)
      .single(),
    cliente
      .from('alumnos_extra')
      .select('alumno_id, profesor_id')
      .or(`profesor_id.eq.${uid},alumno_id.eq.${uid}`),
  ]);

  // ── Validar perfil ────────────────────────────────────────────────────────
  if (perfilRes.error || !perfilRes.data) {
    return fallo(new ErrorAgenda('sin_sesion'));
  }

  if (!perfilRes.data.activo) {
    return fallo(new ErrorAgenda('sin_sesion'));
  }

  const rol = perfilRes.data.rol as UserRol;

  // ── Construir Sets desde vínculos ─────────────────────────────────────────
  const vinculos = vinculosRes.data ?? [];

  const alumnosAsignados = new Set<string>();
  const profesores = new Set<string>();

  for (const v of vinculos) {
    // Si el lector es el profesor de este vínculo → el alumno es su asignado.
    if (v.profesor_id === uid && v.alumno_id) {
      alumnosAsignados.add(v.alumno_id);
    }
    // Si el lector es el alumno de este vínculo → el profesor es su profesor.
    if (v.alumno_id === uid && v.profesor_id) {
      profesores.add(v.profesor_id);
    }
  }

  return ok({
    id: uid,
    rol,
    alumnosAsignados,
    profesores,
  });
}

/**
 * Predicados de consulta por rol que la ruta de API añade sobre RLS.
 *
 * RLS decide **qué filas** son visibles. Este filtro decide **qué subconjunto** de
 * esas filas cada rol ve en su vista de calendario (Requisitos 12.1, 12.2):
 *
 * - Admin: ve todos los eventos.
 * - Profesor: ve sus propios eventos, los de sus alumnos asignados (públicos), y las
 *   Actividades donde es creador o cuyos destinatarios incluyen a sus alumnos.
 * - Alumno: ve sus propios eventos y las Actividades donde es destinatario.
 * - Lector: no ve eventos de agenda (solo tiene acceso a recursos).
 */
export function filtroPorRol(lector: ContextoLector): FiltroRol {
  switch (lector.rol) {
    case 'admin':
      return { tipo: 'todos' };
    case 'profesor':
      return {
        tipo: 'profesor',
        profesorId: lector.id,
        alumnosAsignados: lector.alumnosAsignados,
      };
    case 'alumno':
      return {
        tipo: 'alumno',
        alumnoId: lector.id,
      };
    default:
      return { tipo: 'ninguno' };
  }
}

/** Filtro discriminado por tipo para que la ruta de API lo aplique al query builder. */
export type FiltroRol =
  | { tipo: 'todos' }
  | { tipo: 'profesor'; profesorId: string; alumnosAsignados: ReadonlySet<string> }
  | { tipo: 'alumno'; alumnoId: string }
  | { tipo: 'ninguno' };
