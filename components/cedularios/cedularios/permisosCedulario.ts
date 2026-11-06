import { puedeGestionarCedulario } from '@/lib/cedularios/permisos';
import type { CedulariosUsuario } from '../hooks/useCedulariosUsuario';

/**
 * Requirement 2.14: only an admin, or the profesor who created the cedulario, can delete it or
 * change its universidad. Collaborators, alumno and lector cannot. The database stays the authority.
 *
 * @param creadorId `created_by` of the cedulario (`CedularioListItem.createdBy`).
 */
export function puedeGestionarCedularioDe(
  usuario: Pick<CedulariosUsuario, 'rol' | 'userId'>,
  creadorId: string | null,
): boolean {
  if (usuario.rol === null || usuario.userId === null) return false;
  return puedeGestionarCedulario({
    rol: usuario.rol,
    userId: usuario.userId,
    creadorId,
    colaboradorIds: new Set<string>(),
  });
}
