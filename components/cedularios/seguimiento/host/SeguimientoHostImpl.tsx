'use client';

/**
 * Implementation of the tracking host (seg_modal in the URL). Loaded on demand by
 * `SeguimientoHost`, so it is not part of the initial load of the pages.
 *
 * Responsibilities
 * - Validate the seg_* state against what the user can see: student, assignment of the
 *   cedulario and assigned materia. Anything that does not exist or is not visible is removed
 *   from the URL (with its dependents) and the overlay closes without showing an error.
 * - Render the reviewer (`revision`), the subset editor (`editar_materias`) or the assign
 *   dialog (`asignar`) inside `SeguimientoOverlay`.
 * - Feed the own layer reported by the children to the overlay (`ownLayerOpen`), so Escape
 *   closes that layer first and only then the overlay.
 *
 * The state is restored on page load because everything is derived from the URL.
 */

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { createClient } from '@/lib/supabase/client';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { SEG_STALE_TIME, seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import {
  resolverSegInvalido,
  type DatosValidacionSeg,
} from '@/lib/cedularios/seguimiento/resolver-url';
import {
  fetchResumenAlumno,
  type AsignacionResumen,
  type ResumenAlumno,
} from '@/lib/queries/cedularios/seguimiento/resumen';
import { useProgresoAsignacion } from '../hooks/useProgresoAsignacion';
import { useResumenAlumno } from '../hooks/useResumenAlumno';
import { RevisionCedularioAlumno } from '../revision/RevisionCedularioAlumno';
import { useSegUrl } from '../url/useSegUrl';
import { SeguimientoOverlay } from './SeguimientoOverlay';

// ---------------------------------------------------------------------------
// Heavy content loaded on demand (the reviewer is imported directly: this whole
// module is already loaded lazily by the shell)
// ---------------------------------------------------------------------------

function CargandoContenido() {
  const t = useTranslations('cedularios.seguimiento.comun');
  return (
    <p role="status" className="p-[var(--space-md)] text-sm text-[var(--color-text-muted)]">
      {t('cargando')}
    </p>
  );
}

const AsignarCedularioDialog = dynamic(
  () => import('../asignacion/AsignarCedularioDialog').then((mod) => mod.AsignarCedularioDialog),
  { ssr: false, loading: () => <CargandoContenido /> },
);

const EditarMateriasView = dynamic(
  () => import('../subconjunto/EditarMateriasView').then((mod) => mod.EditarMateriasView),
  { ssr: false, loading: () => <CargandoContenido /> },
);

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * Summary of the student that also lists unassigned assignments. Same key and function as the
 * one the assign dialog uses for reassigning, so both share the cache. The key lives under the
 * summary prefix, so every summary invalidation reaches it.
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

function nombreCompleto(partes: readonly (string | null | undefined)[]): string {
  return partes
    .map((parte) => (parte ?? '').trim())
    .filter((parte) => parte !== '')
    .join(' ');
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

export function SeguimientoHostImpl() {
  const t = useTranslations('cedularios.seguimiento');
  const { estado, cerrar, fijar, limpiarInvalidos } = useSegUrl();
  const [ownLayerOpen, setOwnLayerOpen] = useState(false);

  const modal = estado.modal;
  const alumnoId = estado.alumno;

  // ── Summary of the student ────────────────────────────────────────────────
  // Only "assign dialog with a student and no cedulario" works with active assignments alone;
  // every other mode must see unassigned ones too (an unassigned assignment is still visible).
  const incluirDesasignadas = !(modal === 'asignar' && estado.cedulario === null);
  const resumenActivas = useResumenAlumno(alumnoId, { enabled: !incluirDesasignadas });
  const resumenTodas = useResumenConDesasignadas(alumnoId, incluirDesasignadas);
  const resumenQuery = incluirDesasignadas ? resumenTodas : resumenActivas;
  const resumen = resumenQuery.data ?? null;

  const asignacion = useMemo<AsignacionResumen | null>(() => {
    if (!resumen || estado.cedulario === null) return null;
    return resumen.asignaciones.find((a) => a.cedularioId === estado.cedulario) ?? null;
  }, [resumen, estado.cedulario]);

  // ── Progress of the assignment, only to validate seg_materia ──────────────
  const validaMateria = estado.materia !== null && asignacion !== null;
  const progresoQuery = useProgresoAsignacion(asignacion?.asignacionId, {
    enabled: validaMateria,
  });

  // ── Validation of the URL against what the user can see ───────────────────
  const resumenListo = alumnoId === null || resumenQuery.isSuccess;
  const progresoPendiente = validaMateria && progresoQuery.isPending && !progresoQuery.isError;
  const listo = resumenListo && !progresoPendiente;

  const alumnoVisible = alumnoId !== null && resumen !== null;
  // Assign dialog: the pair may have no active assignment (reassign flow, handled by the dialog),
  // so the cedulario is not checked against the summary.
  const cedularioAsignado = modal === 'asignar' ? true : asignacion !== null;
  const materiaAsignada = useMemo(() => {
    if (estado.materia === null) return true;
    if (asignacion === null) return false;
    // While the progress is unknown or failed, keep the param (the detail panel validates again)
    if (!progresoQuery.isSuccess) return true;
    return progresoQuery.data.some((fila) => fila.materiaId === estado.materia && fila.asignada);
  }, [estado.materia, asignacion, progresoQuery.isSuccess, progresoQuery.data]);

  const datos = useMemo<DatosValidacionSeg>(
    () => ({ alumnoVisible, cedularioAsignado, materiaAsignada }),
    [alumnoVisible, cedularioAsignado, materiaAsignada],
  );
  const hayInvalidos = listo && Object.keys(resolverSegInvalido(estado, datos)).length > 0;

  useEffect(() => {
    if (hayInvalidos) limpiarInvalidos(datos);
  }, [hayInvalidos, datos, limpiarInvalidos]);

  // The edit view needs an active assignment and write access; otherwise go back to the reviewer.
  const editarNoPermitido =
    listo &&
    !hayInvalidos &&
    modal === 'editar_materias' &&
    !(asignacion?.estado === 'activa' && resumen?.puedeEditar === true);

  useEffect(() => {
    if (editarNoPermitido) fijar({ modal: 'revision' });
  }, [editarNoPermitido, fijar]);

  if (modal === null) return null;

  // ── Load error: keep the overlay open with a retry (never for invalid URLs) ─
  if (alumnoId !== null && resumenQuery.isError && !resumenQuery.data) {
    const tituloError =
      modal === 'asignar'
        ? t(estado.cedulario ? 'asignar.titulo_reasignar' : 'asignar.titulo_alumno')
        : t('revision.titulo');
    return (
      <SeguimientoOverlay
        open
        onClose={cerrar}
        ariaLabel={tituloError}
        closeLabel={t('comun.cerrar')}
      >
        <div className="flex h-full min-h-0 flex-col items-start gap-3 bg-[var(--color-bg)] p-[var(--space-md)] pr-12">
          <p role="alert" className="text-sm text-[var(--color-error)]">
            {t('comun.error_carga')}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void resumenQuery.refetch()}
            >
              {t('comun.reintentar')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={cerrar}>
              {t('comun.cerrar')}
            </Button>
          </div>
        </div>
      </SeguimientoOverlay>
    );
  }

  if (!listo || hayInvalidos || editarNoPermitido) return null;

  // ── Assign dialog ─────────────────────────────────────────────────────────
  if (modal === 'asignar') {
    const titulo = !alumnoId
      ? t('asignar.titulo_cedulario')
      : estado.cedulario
        ? t('asignar.titulo_reasignar')
        : t('asignar.titulo_alumno');
    return (
      <SeguimientoOverlay
        open
        onClose={cerrar}
        ariaLabel={titulo}
        closeLabel={t('comun.cerrar')}
        ownLayerOpen={ownLayerOpen}
      >
        <AsignarCedularioDialog onCerrar={cerrar} onCapaPropiaChange={setOwnLayerOpen} />
      </SeguimientoOverlay>
    );
  }

  // revision and editar_materias always have a visible student here (validated above)
  if (!alumnoId || !resumen) return null;

  const alumnoNombre =
    nombreCompleto([resumen.alumno.nombre, resumen.alumno.apellido, resumen.alumno.apellidoMaterno]) ||
    t('comun.alumno_sin_nombre');

  // ── Subset editor ─────────────────────────────────────────────────────────
  if (modal === 'editar_materias') {
    if (!asignacion) return null;
    return (
      <SeguimientoOverlay
        open
        onClose={cerrar}
        ariaLabel={t('subconjunto.titulo')}
        closeLabel={t('comun.cerrar')}
        ownLayerOpen={ownLayerOpen}
      >
        <EditarMateriasView
          asignacionId={asignacion.asignacionId}
          cedularioId={asignacion.cedularioId}
          alumnoId={alumnoId}
          cedularioNombre={asignacion.cedularioNombre}
          alumnoNombre={alumnoNombre}
          onVolver={() => fijar({ modal: 'revision' })}
          onCapaPropiaChange={setOwnLayerOpen}
        />
      </SeguimientoOverlay>
    );
  }

  // ── Reviewer ──────────────────────────────────────────────────────────────
  const asignacionTitulo = asignacion ?? resumen.asignaciones.find((a) => a.estado === 'activa') ?? null;
  const tituloRevision = asignacionTitulo
    ? t('revision.aria_dialogo', { alumno: alumnoNombre, cedulario: asignacionTitulo.cedularioNombre })
    : t('revision.titulo');

  return (
    <SeguimientoOverlay
      open
      onClose={cerrar}
      ariaLabel={tituloRevision}
      closeLabel={t('revision.cerrar')}
      ownLayerOpen={ownLayerOpen}
    >
      <RevisionCedularioAlumno
        alumnoId={alumnoId}
        cedularioId={estado.cedulario}
        modo="auto"
        variante="overlay"
        onCerrar={cerrar}
        onCapaPropiaChange={setOwnLayerOpen}
      />
    </SeguimientoOverlay>
  );
}
