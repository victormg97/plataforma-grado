'use client';
import { useCallback, useMemo } from 'react';
import { accionCedularioPropio } from '@/lib/cedularios/seguimiento/asignatario';
import { useSegRol } from '../hooks/useSegRol';
import { useResumenFicha } from '../ficha/useResumenFicha';
import { useSegUrl } from '../url/useSegUrl';

export interface CedulariosPropios {
  /** True when the session user is a profesor or administrador. */
  esStaff: boolean;
  /** Number of ACTIVE assignments of the user (unassigned ones do not count). */
  totalActivas: number;
  accion: 'asignar' | 'revisar';
  cargando: boolean;
  /** The summary has resolved, so the label is reliable. */
  listo: boolean;
  abrirAsignar: () => void;
  /** Opens the reviewer: the single active cedulario, or the selector (null) when there are several. */
  abrirRevisar: () => void;
}

/**
 * Own cedularios of the logged-in profesor/administrador. Only fetches for staff
 * (`useResumenFicha(null)` is disabled otherwise). Both actions only write the `seg_*` URL
 * state; the global host renders the wizard / reviewer.
 */
export function useCedulariosPropios(): CedulariosPropios {
  const { userId, isStaff } = useSegRol();
  const { abrir } = useSegUrl();
  const { data, isPending } = useResumenFicha(isStaff ? userId : null);

  const activas = useMemo(
    () => (data?.asignaciones ?? []).filter((asignacion) => asignacion.estado === 'activa'),
    [data],
  );
  const totalActivas = activas.length;

  const abrirAsignar = useCallback(() => {
    if (userId) abrir({ modal: 'asignar', alumno: userId });
  }, [abrir, userId]);

  const abrirRevisar = useCallback(() => {
    if (!userId) return;
    abrir({
      modal: 'revision',
      alumno: userId,
      cedulario: activas.length === 1 ? activas[0].cedularioId : null,
    });
  }, [abrir, userId, activas]);

  return {
    esStaff: isStaff,
    totalActivas,
    accion: accionCedularioPropio(totalActivas),
    cargando: isStaff && isPending,
    listo: isStaff && !isPending && data !== undefined,
    abrirAsignar,
    abrirRevisar,
  };
}
