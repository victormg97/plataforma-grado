'use client';

/**
 * Assign dialog of the per-student tracking (seg_modal=asignar). It is the content of the
 * tracking overlay. This container reads the seg_* URL params, loads what the mode needs and
 * gates the wizard (`AsignarWizard`), which renders the header, steps and footer.
 *
 * Three modes, derived from the seg_* URL params:
 * - cedulario fixed (seg_cedulario only): students step, materias step, confirm (tab Alumnos).
 * - student fixed (seg_alumno only): cedularios step (several), materias of each, confirm.
 * - reassign (both): the assignment was unassigned. Both are fixed and the materias that were
 *   assigned when it was unassigned come preselected (read from the progress of that assignment).
 *
 * An inactive student cannot receive assignments from anyone (D-S20): only a notice.
 * `onCapaPropiaChange` tells the overlay while an operation is running, so Escape does not
 * close the overlay and lose the result. `onProgresoChange` lets the host ask before closing.
 */

import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { createClient } from '@/lib/supabase/client';
import { useCedularios } from '@/components/cedularios/hooks/useCedularios';
import { useMateriasTree } from '@/components/cedularios/hooks/useMaterias';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { SEG_STALE_TIME, seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import { tieneDatosDeAvance } from '@/lib/cedularios/seguimiento/subconjunto';
import type { ModoWizard } from '@/lib/cedularios/seguimiento/asignacion-wizard';
import { fetchResumenAlumno, type ResumenAlumno } from '@/lib/queries/cedularios/seguimiento/resumen';
import { useProgresoAsignacion } from '../hooks/useProgresoAsignacion';
import { useResumenAlumno } from '../hooks/useResumenAlumno';
import { useSegUrl } from '../url/useSegUrl';
import type { SeleccionMaterias } from './MateriasSelector';
import { AsignarWizard, type Bloqueo, type CedularioFijo } from './AsignarWizard';

export interface AsignarCedularioDialogProps {
  /** Closes the dialog without asking (after a save, from the result). Defaults to clearing seg_*. */
  onCerrar?: () => void;
  /** Close requested by the user (Cancel). The host asks first when there is progress. */
  onSolicitarCierre?: () => void;
  /** Tells the host whether the user has progress that closing would lose. */
  onProgresoChange?: (hayProgreso: boolean) => void;
  /** True while this dialog has its own layer open (an assignment is running). */
  onCapaPropiaChange?: (abierta: boolean) => void;
}

type ModoAsignar = ModoWizard;

/**
 * Summary of the student including unassigned assignments (needed to find the assignment to
 * reassign). The key lives under the summary prefix, so every summary invalidation reaches it.
 */
function useResumenConDesasignadas(alumnoId: string | null, enabled: boolean) {
  return useQuery<ResumenAlumno | null, CedulariosQueryError>({
    queryKey: [...seguimientoKeys.resumen(alumnoId ?? ''), 'con_desasignadas'] as const,
    queryFn: () => consultar(() => fetchResumenAlumno(createClient(), alumnoId as string, true)),
    enabled: Boolean(alumnoId) && enabled,
    staleTime: SEG_STALE_TIME.resumen,
    retry: reintentarConsulta,
  });
}

// ---------------------------------------------------------------------------
// Container: reads the URL, loads what the mode needs and gates the form
// ---------------------------------------------------------------------------

export function AsignarCedularioDialog({
  onCerrar,
  onSolicitarCierre,
  onProgresoChange,
  onCapaPropiaChange,
}: AsignarCedularioDialogProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tErrores = useTranslations('cedularios.errores');
  const { estado, cerrar } = useSegUrl();
  const cerrarDialogo = onCerrar ?? cerrar;

  const alumnoId = estado.alumno;
  const cedularioId = estado.cedulario;
  const modo: ModoAsignar = alumnoId && cedularioId ? 'reasignar' : alumnoId ? 'alumno' : 'cedulario';

  const cedularios = useCedularios();
  const resumenActivas = useResumenAlumno(alumnoId, { enabled: modo === 'alumno' });
  const resumenTodas = useResumenConDesasignadas(alumnoId, modo === 'reasignar');
  const resumenQuery = modo === 'reasignar' ? resumenTodas : resumenActivas;
  const resumen = resumenQuery.data ?? null;

  // Assignment to reassign: the one of the (student, cedulario) pair, whatever its state
  const previa = useMemo(
    () =>
      modo === 'reasignar'
        ? (resumen?.asignaciones.find((asignacion) => asignacion.cedularioId === cedularioId) ?? null)
        : null,
    [modo, resumen, cedularioId],
  );
  const leePrevias = previa?.estado === 'desasignada';

  const progresoQuery = useProgresoAsignacion(previa?.asignacionId, { enabled: leePrevias });
  const arbolQuery = useMateriasTree(modo === 'reasignar' && leePrevias ? cedularioId : null);

  const materiasIniciales = useMemo<SeleccionMaterias>(() => {
    if (!leePrevias) return 'todas';
    const activas = new Set((arbolQuery.data ?? []).filter((n) => n.activo).map((n) => n.id));
    const previas = (progresoQuery.data ?? [])
      .filter((fila) => fila.asignada && activas.has(fila.materiaId))
      .map((fila) => fila.materiaId);
    // Same set as "all": keep the default so new materias are included too
    return previas.length > 0 && previas.length === activas.size ? 'todas' : previas;
  }, [leePrevias, arbolQuery.data, progresoQuery.data]);

  const conAvance = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>();
    for (const fila of progresoQuery.data ?? []) {
      if (tieneDatosDeAvance(fila)) ids.add(fila.materiaId);
    }
    return ids;
  }, [progresoQuery.data]);

  const cargando =
    (modo === 'cedulario' && cedularios.isPending) ||
    (modo !== 'cedulario' && resumenQuery.isPending) ||
    (leePrevias && (progresoQuery.isPending || arbolQuery.isPending));
  const hayError =
    (modo === 'cedulario' && cedularios.isError) ||
    (modo !== 'cedulario' && resumenQuery.isError) ||
    (leePrevias && (progresoQuery.isError || arbolQuery.isError));

  const reintentar = () => {
    if (modo === 'cedulario' && cedularios.isError) void cedularios.refetch();
    if (modo !== 'cedulario' && resumenQuery.isError) void resumenQuery.refetch();
    if (leePrevias && progresoQuery.isError) void progresoQuery.refetch();
    if (leePrevias && arbolQuery.isError) void arbolQuery.refetch();
  };

  // Cedulario fixed by the URL (cedulario and reassign modes)
  let cedularioFijo: CedularioFijo | null = null;
  if (modo === 'cedulario') {
    const item = (cedularios.data ?? []).find((c) => c.id === cedularioId);
    if (item?.activo) cedularioFijo = { id: item.id, nombre: item.nombre };
  } else if (modo === 'reasignar' && previa) {
    cedularioFijo = { id: previa.cedularioId, nombre: previa.cedularioNombre };
  }

  // Message shown instead of the form when the dialog cannot work
  let mensaje: string | null = null;
  if (!cargando && !hayError) {
    if (modo === 'cedulario' && !cedularioFijo) mensaje = tErrores('cedulario_no_disponible');
    else if (modo !== 'cedulario' && !resumen) mensaje = t('comun.error_carga');
    else if (modo === 'reasignar' && !previa) mensaje = tErrores('cedulario_no_disponible');
  }

  const vacio = (contenido: ReactNode, accion?: ReactNode) => (
    <div className="flex h-full min-h-0 flex-col items-start gap-3 bg-[var(--color-bg)] p-[var(--space-md)] pr-12">
      {contenido}
      <div className="flex gap-2">
        {accion}
        <Button type="button" variant="ghost" size="sm" onClick={cerrarDialogo}>
          {t('comun.cerrar')}
        </Button>
      </div>
    </div>
  );

  if (hayError) {
    return vacio(
      <p role="alert" className="text-sm text-[var(--color-error)]">
        {t('comun.error_carga')}
      </p>,
      <Button type="button" variant="secondary" size="sm" onClick={reintentar}>
        {t('comun.reintentar')}
      </Button>,
    );
  }

  if (cargando) {
    return vacio(
      <p role="status" className="text-sm text-[var(--color-text-muted)]">
        {t('comun.cargando')}
      </p>,
    );
  }

  if (mensaje) {
    return vacio(
      <p role="alert" className="text-sm text-[var(--color-error)]">
        {mensaje}
      </p>,
    );
  }

  let bloqueo: Bloqueo | null = null;
  if (resumen && !resumen.alumno.activo) bloqueo = 'inactivo';
  else if (resumen && !resumen.puedeAsignar) bloqueo = 'sin_permisos';
  else if (previa?.estado === 'activa') bloqueo = 'ya_asignado';

  const idsAsignados =
    modo === 'alumno'
      ? (resumen?.asignaciones ?? [])
          .filter((asignacion) => asignacion.estado === 'activa')
          .map((asignacion) => asignacion.cedularioId)
      : [];

  return (
    <AsignarWizard
      key={`${modo}:${alumnoId ?? ''}:${cedularioId ?? ''}:${previa?.asignacionId ?? ''}`}
      modo={modo}
      cedularioFijo={cedularioFijo}
      alumnoFijo={resumen?.alumno ?? null}
      bloqueo={bloqueo}
      idsAsignados={idsAsignados}
      materiasIniciales={materiasIniciales}
      conAvance={conAvance}
      onCerrar={cerrarDialogo}
      onSolicitarCierre={onSolicitarCierre ?? cerrarDialogo}
      onProgresoChange={onProgresoChange}
      onCapaPropiaChange={onCapaPropiaChange}
    />
  );
}
