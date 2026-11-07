'use client';

/**
 * Edit view of the subset of materias assigned to a student (seg_modal=editar_materias).
 *
 * - Shows the full tree of active materias with a checkbox each (SubconjuntoArbol).
 * - The selection is a local draft. Until the user touches a checkbox the view follows the
 *   server state, so a realtime refetch never hides new data. After a failed save the draft is
 *   kept so the user does not lose the selection.
 * - Only the differences (added and removed ids) are sent, in one call.
 * - If some materias to remove hold progress data, a confirmation dialog opens first. Removed
 *   materias are archived, never deleted.
 * - An empty subset can be saved.
 * - `onCapaPropiaChange` tells the overlay when this view has its own layer open (the
 *   confirmation dialog), so Escape closes that layer first.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useMateriasTree } from '@/components/cedularios/hooks/useMaterias';
import {
  diferenciaSubconjunto,
  resumenDeQuitar,
  tieneDatosDeAvance,
} from '@/lib/cedularios/seguimiento/subconjunto';
import { useEstablecerMaterias } from '../hooks/useEstablecerMaterias';
import { useProgresoAsignacion } from '../hooks/useProgresoAsignacion';
import { ConfirmarQuitarDialog } from './ConfirmarQuitarDialog';
import { SubconjuntoArbol } from './SubconjuntoArbol';

export interface EditarMateriasViewProps {
  asignacionId: string;
  cedularioId: string;
  alumnoId: string;
  cedularioNombre: string;
  alumnoNombre: string;
  /** Closes the view and goes back to seg_modal=revision (back button and after a save). */
  onVolver: () => void;
  /** True while this view has its own layer open (the confirmation dialog). */
  onCapaPropiaChange?: (abierta: boolean) => void;
}

export function EditarMateriasView({
  asignacionId,
  cedularioId,
  alumnoId,
  cedularioNombre,
  alumnoNombre,
  onVolver,
  onCapaPropiaChange,
}: EditarMateriasViewProps) {
  const t = useTranslations('cedularios.seguimiento');

  const arbol = useMateriasTree(cedularioId);
  const progreso = useProgresoAsignacion(asignacionId);
  const mutation = useEstablecerMaterias();
  const guardando = mutation.isPending;

  const [draft, setDraft] = useState<ReadonlySet<string> | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Report the own layer to the overlay; always release it on unmount
  const onCapaRef = useRef(onCapaPropiaChange);
  useEffect(() => {
    onCapaRef.current = onCapaPropiaChange;
  });
  useEffect(() => {
    onCapaRef.current?.(confirmando);
  }, [confirmando]);
  useEffect(() => {
    return () => onCapaRef.current?.(false);
  }, []);

  const flat = useMemo(() => arbol.data ?? [], [arbol.data]);
  const filasProgreso = useMemo(() => progreso.data ?? [], [progreso.data]);

  // Current subset on the server: assigned rows whose materia is active in the tree
  const actuales = useMemo(() => {
    const activas = new Set<string>();
    for (const n of flat) {
      if (n.activo) activas.add(n.id);
    }
    const ids = new Set<string>();
    for (const fila of filasProgreso) {
      if (fila.asignada && activas.has(fila.materiaId)) ids.add(fila.materiaId);
    }
    return ids;
  }, [flat, filasProgreso]);

  // Materias that hold progress data (marker in the tree)
  const conAvance = useMemo(() => {
    const ids = new Set<string>();
    for (const fila of filasProgreso) {
      if (tieneDatosDeAvance(fila)) ids.add(fila.materiaId);
    }
    return ids;
  }, [filasProgreso]);

  const seleccion: ReadonlySet<string> = draft ?? actuales;
  const diferencia = useMemo(() => diferenciaSubconjunto(actuales, seleccion), [actuales, seleccion]);
  const resumen = useMemo(
    () => resumenDeQuitar(filasProgreso, diferencia.quitar),
    [filasProgreso, diferencia.quitar],
  );
  const hayCambios = diferencia.agregar.length > 0 || diferencia.quitar.length > 0;

  const handleChange = useCallback((nueva: Set<string>) => setDraft(nueva), []);

  const aplicar = () => {
    if (guardando || !hayCambios) return;
    mutation.mutate(
      {
        asignacionId,
        agregar: diferencia.agregar,
        quitar: diferencia.quitar,
        alumnoId,
        cedularioId,
      },
      {
        onSuccess: (resultado) => {
          if (!resultado.ok) return;
          setConfirmando(false);
          setDraft(null);
          onVolver();
        },
        onSettled: (resultado) => {
          // On failure keep the draft and release the confirmation so the error is visible
          if (!resultado || !resultado.ok) setConfirmando(false);
        },
      },
    );
  };

  const handleGuardar = () => {
    if (guardando || !hayCambios) return;
    if (resumen.conAvance > 0) {
      setConfirmando(true);
      return;
    }
    aplicar();
  };

  const cargando = arbol.isPending || progreso.isPending;
  const hayError = arbol.isError || progreso.isError;

  const reintentar = () => {
    if (arbol.isError) void arbol.refetch();
    if (progreso.isError) void progreso.refetch();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg)]">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] p-[var(--space-md)]">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft aria-hidden="true" />}
            onClick={onVolver}
            disabled={guardando}
          >
            {t('subconjunto.volver')}
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t('subconjunto.titulo')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('subconjunto.descripcion', { alumno: alumnoNombre, cedulario: cedularioNombre })}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-md)]">
        {hayError ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-sm text-[var(--color-error)]">{t('comun.error_carga')}</p>
            <Button type="button" variant="secondary" size="sm" onClick={reintentar}>
              {t('comun.reintentar')}
            </Button>
          </div>
        ) : cargando ? (
          <p role="status" className="text-sm text-[var(--color-text-muted)]">
            {t('comun.cargando')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <SubconjuntoArbol
              flat={flat}
              seleccion={seleccion}
              onChange={handleChange}
              conAvance={conAvance}
              disabled={guardando}
            />
            {seleccion.size === 0 && (
              <p
                role="status"
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-sm)] text-sm text-[var(--color-text-muted)]"
              >
                {t('subconjunto.vacio_aviso')}
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-md)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5 text-sm" aria-live="polite">
          <span className="font-medium text-[var(--color-text-primary)]">
            {t('subconjunto.seleccionadas', { count: seleccion.size })}
          </span>
          <span className="text-[var(--color-text-muted)]">
            {hayCambios
              ? t('subconjunto.cambios', {
                  agregar: diferencia.agregar.length,
                  quitar: diferencia.quitar.length,
                })
              : t('subconjunto.sin_cambios')}
          </span>
          {resumen.conAvance > 0 && (
            <span className="text-[var(--color-error)]">
              {t('subconjunto.quitar_con_avance', { count: resumen.conAvance })}
            </span>
          )}
        </div>
        <Button
          type="button"
          onClick={handleGuardar}
          disabled={cargando || hayError || !hayCambios}
          loading={guardando && !confirmando}
        >
          {guardando ? t('subconjunto.guardando') : t('subconjunto.guardar')}
        </Button>
      </footer>

      <ConfirmarQuitarDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={aplicar}
        conAvance={resumen.conAvance}
        loading={guardando}
      />
    </div>
  );
}
