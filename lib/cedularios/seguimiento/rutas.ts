/**
 * Routes used by the tracking entries.
 * Pure module: no React, no Supabase.
 */

// horarioNavigation is a pure module (string helpers only), so it is safe to reuse here.
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';

type RolConRuta = 'admin' | 'profesor';

/** Student profile route of the role (the same one the student lists use). */
export const rutaPerfilAlumno = (rol: RolConRuta, alumnoId: string): string =>
  rol === 'admin' ? `/admin/alumnos/${alumnoId}` : `/profesor/alumnos/${alumnoId}`;

/** Class detail route of the role; `desde` is the path to come back to. */
export const rutaDetalleClase = (rol: RolConRuta, horarioId: string, desde: string): string =>
  buildClaseDetailHref(horarioId, rol, desde);
