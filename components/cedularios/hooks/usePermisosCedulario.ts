'use client';

import { useMemo } from 'react';
import {
  puedeEditarCedulario,
  puedeGestionarCedulario,
  puedeVerHistorial as rolPuedeVerHistorial,
} from '@/lib/cedularios/permisos';
import { useCedulariosUsuario } from './useCedulariosUsuario';

export interface PermisosCedulario {
  /** Edit content, materias, temario and enlaces: admin, creator or collaborator. */
  puedeEditar: boolean;
  /** Delete, grant/revoke permisos, change universidad: admin or creator. */
  puedeGestionar: boolean;
  /** admin or profesor. */
  puedeVerHistorial: boolean;
  /** `!puedeEditar`. True while the cedulario or the collaborators are still loading. */
  isReadOnly: boolean;
}

/**
 * Permissions of the current user on one cedulario, derived with the pure rules of
 * `lib/cedularios/permisos.ts`. Rights only grow once the data is known: until `cedulario` is
 * loaded nothing is editable, and a collaborator stays read-only until `colaboradores` loads.
 * When the permission list is refetched and the user is no longer in it, `puedeEditar` turns false.
 *
 * @param cedulario `created_by` of the cedulario (`useCedulario().data`), or null/undefined while loading.
 * @param colaboradores Collaborators (`usePermisos().data`), or undefined while loading or not readable.
 */
export function usePermisosCedulario(
  cedulario: { created_by: string | null } | null | undefined,
  colaboradores: readonly { id: string }[] | null | undefined,
): PermisosCedulario {
  const { userId, rol } = useCedulariosUsuario();
  const creadorId = cedulario ? cedulario.created_by : undefined;

  return useMemo<PermisosCedulario>(() => {
    const verHistorial = rol !== null && rolPuedeVerHistorial(rol);
    if (rol === null || userId === null || creadorId === undefined) {
      return { puedeEditar: false, puedeGestionar: false, puedeVerHistorial: verHistorial, isReadOnly: true };
    }

    const ctx = {
      rol,
      userId,
      creadorId,
      colaboradorIds: new Set((colaboradores ?? []).map((c) => c.id)),
    };
    const puedeEditar = puedeEditarCedulario(ctx);
    return {
      puedeEditar,
      puedeGestionar: puedeGestionarCedulario(ctx),
      puedeVerHistorial: verHistorial,
      isReadOnly: !puedeEditar,
    };
  }, [rol, userId, creadorId, colaboradores]);
}
