/**
 * Slice `visibilidad` — matriz de lectura y edición (Requisitos 8.3–8.9, 3.7, 4.14,
 * 4.15, 5.5).
 *
 * Todas las funciones de este archivo son **puras**: sin efectos, sin acceso a datos,
 * sin dependencias de runtime. Reciben el contexto del lector y los atributos del
 * evento y devuelven un booleano.
 *
 * Dependencias: solo tipos de `@/lib/supabase/types` y `@/lib/agenda/nucleo`.
 */
import type { AgendaVisibilidad, UserRol } from '@/lib/supabase/types';
import type { AutorResumen, EventoAgendaBase } from '@/lib/agenda/nucleo';

/**
 * Contexto del usuario que está leyendo la agenda. Lo construye
 * `resolverContextoLector` en `filtros.servidor.ts`.
 */
export interface ContextoLector {
  id: string;
  rol: UserRol;
  /** Identificadores de los Alumnos_Asignados del lector, cuando el lector es Profesor. */
  alumnosAsignados: ReadonlySet<string>;
  /** Identificadores de los Profesores del lector, cuando el lector es Alumno. */
  profesores: ReadonlySet<string>;
}

/**
 * Matriz del Requisito 8, criterios 8.3 a 8.9.
 *
 * Orden de las guardas:
 *  1. Propio → true (Req 8.9)
 *  2. Privada ajena → false (Req 8.3) — **antes** de la guarda de rol
 *  3. Admin → true (Req 8.7)
 *  4. Profesor lee admin/profesor → true (Req 8.4)
 *  5. Profesor lee alumno → solo si es su asignado (Req 8.6)
 *  6. Else → false (Reqs 8.5, 8.8)
 */
export function puedeLeerEntradaPersonal(
  lector: ContextoLector,
  autor: Pick<AutorResumen, 'id' | 'rol'>,
  visibilidad: AgendaVisibilidad,
): boolean {
  // Req 8.9: el Autor siempre lee sus propias entradas.
  if (lector.id === autor.id) return true;

  // Req 8.3: una Entrada_Personal privada ajena NUNCA es visible, ni para Admin.
  if (visibilidad === 'privada') return false;

  // Req 8.7: el Admin lee toda Entrada_Personal pública ajena.
  if (lector.rol === 'admin') return true;

  // Req 8.4: un Profesor lee las públicas de otros Profesores y de Admins.
  if (lector.rol === 'profesor') {
    if (autor.rol === 'admin' || autor.rol === 'profesor') return true;
    // Req 8.6: un Profesor lee las públicas de sus alumnos asignados.
    if (autor.rol === 'alumno') return lector.alumnosAsignados.has(autor.id);
  }

  // Reqs 8.5, 8.8: Alumno no lee públicas ajenas; Lector no lee nada.
  return false;
}

/**
 * Determina si el lector puede editar un evento (Requisitos 3.7, 4.14, 4.15, 5.5).
 *
 * - El Autor siempre puede editar su propio evento.
 * - El Admin puede editar eventos con alcance distinto de `personal` (Actividades).
 * - Nadie más puede editar.
 */
export function puedeEditarEvento(
  lector: ContextoLector,
  evento: Pick<EventoAgendaBase, 'alcance'> & { autorId: string },
): boolean {
  // Requisitos 3.7, 5.5: el Autor siempre edita lo suyo.
  if (lector.id === evento.autorId) return true;

  // Requisito 4.14: Admin puede editar Actividades (alcance !== 'personal').
  if (lector.rol === 'admin' && evento.alcance !== 'personal') return true;

  // Requisito 4.15: nadie más edita eventos ajenos.
  return false;
}
