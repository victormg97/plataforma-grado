import type { QueryClient } from '@tanstack/react-query';
import { seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import { TOAST_DURATION_MS } from '@/components/cedularios/hooks/useCedulariosAction';
import { toast } from 'sonner';

/** What changed in the tracking cache. Missing ids widen the invalidation to the whole prefix. */
export interface AlcanceInvalidacion {
  /** Students whose summary changed. Missing or empty: every student summary. */
  alumnoIds?: readonly string[];
  /** Cedulario whose student list changed. Missing: the lists of every cedulario. */
  cedularioId?: string;
  /** Assignments whose progress, activity and archived subjects changed. */
  asignacionIds?: readonly string[];
}

/** Prefix of the selector lists (`asignables`) of one cedulario, or of all of them. */
function prefijoAsignables(cedularioId: string | undefined) {
  return cedularioId
    ? ([...seguimientoKeys.all, 'asignables', cedularioId] as const)
    : ([...seguimientoKeys.all, 'asignables'] as const);
}

/**
 * Invalidates the tracking queries touched by an assignment, unassignment or subset change:
 * student summaries, student list of the cedulario, selectors and, per assignment,
 * progress, activity and archived subjects. Not awaited.
 */
export function invalidarSeguimiento(qc: QueryClient, alcance: AlcanceInvalidacion): void {
  const { alumnoIds, cedularioId, asignacionIds } = alcance;

  if (alumnoIds && alumnoIds.length > 0) {
    for (const alumnoId of alumnoIds) {
      void qc.invalidateQueries({ queryKey: seguimientoKeys.resumen(alumnoId) });
    }
  } else {
    void qc.invalidateQueries({ queryKey: seguimientoKeys.resumenes() });
  }

  void qc.invalidateQueries({
    queryKey: cedularioId
      ? ([...seguimientoKeys.alumnosTodos(), cedularioId] as const)
      : seguimientoKeys.alumnosTodos(),
  });
  void qc.invalidateQueries({ queryKey: prefijoAsignables(cedularioId) });
  void qc.invalidateQueries({ queryKey: seguimientoKeys.staffConteos() });
  void qc.invalidateQueries({ queryKey: seguimientoKeys.alumnosConteos() });

  for (const asignacionId of asignacionIds ?? []) {
    void qc.invalidateQueries({ queryKey: seguimientoKeys.progreso(asignacionId) });
    void qc.invalidateQueries({ queryKey: seguimientoKeys.actividad(asignacionId) });
    void qc.invalidateQueries({ queryKey: seguimientoKeys.inactivas(asignacionId) });
  }
}

/** Success toast of the tracking (5 s, dismissible), same options as the phase 1 toasts. */
export function mostrarExitoSeguimiento(mensaje: string): void {
  toast.success(mensaje, {
    duration: TOAST_DURATION_MS,
    dismissible: true,
    closeButton: true,
  });
}

/** Translator of a `useTranslations` namespace, with the loose signature the module uses. */
export type TraductorSeguimiento = (key: string, values?: Record<string, string | number>) => string;
