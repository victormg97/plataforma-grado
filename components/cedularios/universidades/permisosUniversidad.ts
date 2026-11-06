import type { Universidad } from '@/lib/queries/cedularios/universidades';
import type { CedulariosUsuario } from '../hooks/useCedulariosUsuario';

/**
 * Requirement 1.13: only an admin, or the profesor who created the universidad, can edit or
 * delete it. Alumno and lector never can. The database (RLS) stays the authority.
 */
export function puedeGestionarUniversidad(
  usuario: Pick<CedulariosUsuario, 'isAdmin' | 'isProfesor' | 'userId'>,
  universidad: Pick<Universidad, 'created_by'>,
): boolean {
  if (usuario.isAdmin) return true;
  return (
    usuario.isProfesor &&
    usuario.userId !== null &&
    universidad.created_by !== null &&
    universidad.created_by === usuario.userId
  );
}
