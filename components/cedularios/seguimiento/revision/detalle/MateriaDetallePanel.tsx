'use client';

/**
 * Detail panel of one assigned materia inside the Revisor (`seg_materia`).
 *
 * - Header: back button (small screens only), code and name, coverage checkbox with the covered
 *   date, and the materia description as plain text.
 * - Note comes from the already loaded progress row. Comments, repasos and linked classes are
 *   loaded on demand with `useProgresoDetalle` (one round trip) with loading and error states.
 *   A refetch (or a realtime signal) never replaces the sections with a loader: the data on
 *   screen is kept and every form keeps its own local text.
 * - Edit mode shows forms; read mode shows the same content as text.
 * - If the materia is not an assigned materia of the assignment (unknown, archived, inactive,
 *   or turned into context after a realtime change) the panel calls `onCerrar`, so the caller
 *   removes `seg_materia` from the URL.
 *
 * Escape: the panel is a layer of its own. While mounted it reports `onCapaPropiaChange(true)`
 * so the overlay Escape guard stays out, and it handles Escape itself in the capture phase:
 * events born inside the same dialog popup close the panel only (the event is stopped, so no
 * dialog underneath reacts). Events from other dialogs (confirmations, class picker) are left
 * to those dialogs.
 */

import { useCallback, useEffect, useId, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import type { EstadoVisual } from '@/lib/cedularios/seguimiento/cascada';
import type { ProgresoFila } from '@/lib/cedularios/seguimiento/tipos';
import type { MateriaNodo } from '@/lib/cedularios/tree';
import { useEstablecerEstadoMateria } from '../../hooks/useEstablecerEstadoMateria';
import { useProgresoDetalle } from '../../hooks/useProgresoDetalle';
import { FechaCubiertaPicker } from '../FechaCubiertaPicker';
import { ProgresoCheck } from '../ProgresoCheck';
import { CambiosSinGuardarProvider } from './cambiosSinGuardar';
import { ClasesVinculadasSection } from './ClasesVinculadasSection';
import { ComentariosSection } from './ComentariosSection';
import { NotaSection } from './NotaSection';
import { RepasosSection } from './RepasosSection';

/** Selector of the layers that own their Escape key (dialogs rendered by Base UI). */
const SELECTOR_CAPA = '[role="dialog"],[role="alertdialog"]';

export interface MateriaDetallePanelProps {
  /** Assignment that owns the progress row. */
  asignacionId: string;
  /** Materia from the active tree, or undefined when `seg_materia` is not in it. */
  materia: MateriaNodo | undefined;
  /** Progress row of the materia, or undefined when there is none. */
  progreso: ProgresoFila | undefined;
  /**
   * True once the materia structure and the progress list are loaded. Until then the panel
   * never decides that the materia is invalid.
   */
  datosListos: boolean;
  /** Edit mode. Read mode shows text only. */
  editable: boolean;
  /** Checkbox state of the materia and its branch (`estadoVisual` of the branch aggregate). */
  estadoCobertura: EstadoVisual;
  /** True when the materia has assigned descendants (the checkbox acts on the branch). */
  esRama?: boolean;
  /** Toggles the coverage of the materia and its branch (parent / child cascade). */
  onAlternarCobertura: (materiaId: string) => void;
  /** True while a cascade batch is being saved. */
  guardandoCobertura?: boolean;
  /**
   * User asked to close the panel (X button, "Volver", Escape). The caller asks first when a form
   * holds unsaved text, then removes `seg_materia`.
   */
  onCerrar: () => void;
  /**
   * The materia is not an assigned materia of the assignment any more: close without asking.
   * Defaults to `onCerrar`.
   */
  onInvalida?: () => void;
  /** Reports whether any form of the panel holds unsaved text. */
  onCambiosPendientesChange?: (hayCambios: boolean) => void;
  /** Reports whether the panel is an own layer, so the overlay Escape guard stays out. */
  onCapaPropiaChange?: (abierta: boolean) => void;
  className?: string;
}

export function MateriaDetallePanel({
  asignacionId,
  materia,
  progreso,
  datosListos,
  editable,
  estadoCobertura,
  esRama = false,
  onAlternarCobertura,
  guardandoCobertura = false,
  onCerrar,
  onInvalida,
  onCambiosPendientesChange,
  onCapaPropiaChange,
  className,
}: MateriaDetallePanelProps) {
  const t = useTranslations('cedularios.seguimiento.detalle');
  const idBase = useId();
  const raizRef = useRef<HTMLElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // The materia is valid only when it is active and has an assigned progress row.
  const valida = Boolean(materia?.activo && progreso && progreso.asignada);
  const progresoId = valida ? (progreso?.id ?? null) : null;

  // Latest callbacks live in refs so the effects below depend only on real state.
  const onCerrarRef = useRef(onCerrar);
  const onInvalidaRef = useRef(onInvalida ?? onCerrar);
  const onCapaRef = useRef(onCapaPropiaChange);
  useEffect(() => {
    onCerrarRef.current = onCerrar;
    onInvalidaRef.current = onInvalida ?? onCerrar;
    onCapaRef.current = onCapaPropiaChange;
  }, [onCerrar, onInvalida, onCapaPropiaChange]);

  // Drop `seg_materia` when it is not an assigned materia of this assignment (no question asked:
  // there is nothing left to edit).
  useEffect(() => {
    if (datosListos && !valida) onInvalidaRef.current();
  }, [datosListos, valida]);

  // Report the own layer while the panel shows a valid materia.
  useEffect(() => {
    if (!valida) return;
    const notificar = onCapaRef.current;
    notificar?.(true);
    return () => notificar?.(false);
  }, [valida]);

  // Own Escape handling, capture phase, scoped to the dialog popup that holds the panel.
  useEffect(() => {
    if (!valida) return;

    function manejarTecla(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented) return;
      const raiz = raizRef.current;
      const destino = event.target;
      if (!raiz || !(destino instanceof Element)) return;

      const capaPropia = raiz.closest(SELECTOR_CAPA);
      const ambito: Element = capaPropia ?? raiz;
      if (!ambito.contains(destino)) return;
      // A different dialog (confirmation, class picker) handles its own Escape.
      if (destino.closest(SELECTOR_CAPA) !== capaPropia) return;

      event.stopPropagation();
      onCerrarRef.current();
    }

    window.addEventListener('keydown', manejarTecla, true);
    return () => window.removeEventListener('keydown', manejarTecla, true);
  }, [valida]);

  // Move the focus to the panel title when a materia opens, so keyboard users land in it.
  useEffect(() => {
    if (valida) tituloRef.current?.focus({ preventScroll: true });
  }, [valida, progresoId]);

  const detalle = useProgresoDetalle(progresoId, { enabled: valida });
  const { mutate: establecerEstado, isPending: guardandoEstado } = useEstablecerEstadoMateria(
    asignacionId,
    progresoId ?? '',
  );

  const cubierta = progreso?.estado === 'cubierta';
  const guardando = guardandoEstado || guardandoCobertura;

  // Same cascade as the tree, so the ancestors stay in sync from the detail too.
  const materiaId = materia?.id ?? null;
  const alternarCobertura = useCallback(() => {
    if (materiaId) onAlternarCobertura(materiaId);
  }, [onAlternarCobertura, materiaId]);

  const cambiarFecha = useCallback(
    (fecha: string) => {
      establecerEstado({ estado: 'cubierta', fecha });
    },
    [establecerEstado],
  );

  if (!valida || !materia || !progreso) return null;

  const nombreCompleto = `${materia.codigo} ${materia.nombre}`.trim();
  const descripcion = materia.descripcion?.trim() ?? '';
  const datos = detalle.data;

  return (
    <CambiosSinGuardarProvider onChange={onCambiosPendientesChange}>
    <section
      ref={raizRef}
      aria-label={t('aria_panel', { materia: nombreCompleto })}
      className={cn(
        'flex min-h-0 flex-col gap-5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4',
        className,
      )}
    >
      <header className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="size-4" aria-hidden="true" />}
          onClick={onCerrar}
          className="self-start md:hidden"
        >
          {t('volver')}
        </Button>

        <div className="flex items-start justify-between gap-2">
          <h3
            ref={tituloRef}
            tabIndex={-1}
            className="min-w-0 break-words text-base font-semibold text-[var(--color-text-primary)] outline-none"
          >
            {nombreCompleto}
          </h3>
          {/* Close button (md and up; small screens use "Volver" above). Guarded by the caller. */}
          <button
            type="button"
            onClick={onCerrar}
            aria-label={t('cerrar_aria', { materia: nombreCompleto })}
            title={t('cerrar')}
            className="-mr-1 -mt-1 hidden size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] md:flex"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-2" role="group" aria-labelledby={`${idBase}-cobertura`}>
          <span
            id={`${idBase}-cobertura`}
            className="text-xs font-medium uppercase text-[var(--color-text-muted)]"
          >
            {t('cobertura.titulo')}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <ProgresoCheck
              estado={estadoCobertura}
              rama={esRama}
              materia={nombreCompleto}
              editable={editable && !guardando}
              onToggle={alternarCobertura}
              focusable
            />
            <span className="text-sm text-[var(--color-text-primary)]">
              {cubierta ? t('cobertura.cubierta') : t('cobertura.pendiente')}
            </span>
            <FechaCubiertaPicker
              value={progreso.fechaCubierta}
              materia={nombreCompleto}
              editable={editable}
              onChange={cambiarFecha}
              disabled={guardando}
              focusable
            />
          </div>
          {editable && cubierta && (
            <p className="text-xs text-[var(--color-text-muted)]">{t('cobertura.fecha_ayuda')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('descripcion')}
          </h4>
          {descripcion ? (
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">
              {descripcion}
            </p>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">{t('sin_descripcion')}</p>
          )}
        </div>
      </header>

      <NotaSection
        key={`nota-${progreso.id}`}
        asignacionId={asignacionId}
        progresoId={progreso.id}
        nota={progreso.notas}
        editable={editable}
      />

      {datos ? (
        <>
          <ComentariosSection
            key={`comentarios-${progreso.id}`}
            asignacionId={asignacionId}
            progresoId={progreso.id}
            comentarios={datos.comentarios}
            editable={editable}
          />
          <RepasosSection
            key={`repasos-${progreso.id}`}
            asignacionId={asignacionId}
            progresoId={progreso.id}
            repasos={datos.repasos}
            editable={editable}
          />
          <ClasesVinculadasSection
            key={`clases-${progreso.id}`}
            asignacionId={asignacionId}
            progresoId={progreso.id}
            clases={datos.clases}
            editable={editable}
          />
        </>
      ) : detalle.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
        >
          <p className="text-sm text-[var(--color-error)]">{t('error_carga')}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={detalle.isFetching}
            onClick={() => void detalle.refetch()}
          >
            {t('reintentar')}
          </Button>
        </div>
      ) : (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <span className="sr-only">{t('cargando')}</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-16 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            />
          ))}
        </div>
      )}
    </section>
    </CambiosSinGuardarProvider>
  );
}
