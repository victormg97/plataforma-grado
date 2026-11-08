'use client';

/**
 * One row of the tracking tree of the Revisor.
 *
 * - Assigned materia: coverage checkbox, code, name (highlighted on search), covered date,
 *   indicators (reviews, note, comments, linked classes) and the branch percentage when the
 *   materia has children.
 * - Context materia: dimmed, never counts. It only gives context to assigned ones; its checkbox
 *   is derived from its assigned descendants and a click acts on them.
 * - The checkbox of a branch shows checked, unchecked or mixed from the branch aggregate and a
 *   click runs the parent / child cascade (`onAlternarCobertura`, one batch).
 *
 * The row is a treeitem with a roving tabindex owned by the tree. Space toggles the checkbox,
 * Enter opens the detail and the arrow keys are forwarded to the tree. The covered-date mutation
 * is created only for assigned rows (one hook instance per progress row) in an inner component.
 */

import { memo, useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, MessageSquare, RotateCcw, StickyNote, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resaltar } from '@/lib/cedularios/busqueda';
import { Resaltado } from '@/components/cedularios/estructura/MateriaTreeRow';
import { ALTURA_FILA } from '@/lib/cedularios/seguimiento/constants';
import { calcularPorcentaje, formatearPorcentaje } from '@/lib/cedularios/seguimiento/porcentaje';
import type { Agregado } from '@/lib/cedularios/seguimiento/agregados';
import { estadoVisual } from '@/lib/cedularios/seguimiento/cascada';
import type { ProgresoFila, RolMateria } from '@/lib/cedularios/seguimiento/tipos';
import type { TeclaArbol } from '@/lib/cedularios/seguimiento/tree-nav';
import type { MateriaNodo } from '@/lib/cedularios/tree';
import { PorcentajeTexto } from '../compartidos/PorcentajeTexto';
import { useEstablecerEstadoMateria } from '../hooks/useEstablecerEstadoMateria';
import { FechaCubiertaPicker } from './FechaCubiertaPicker';
import { ariaCheckedDe, ProgresoCheck } from './ProgresoCheck';

/** Indentation added per level of depth, in px. */
const SANGRIA_POR_NIVEL = 20;

const TECLAS_ARBOL: ReadonlySet<string> = new Set<TeclaArbol>([
  'ArrowDown',
  'ArrowUp',
  'ArrowRight',
  'ArrowLeft',
  'Home',
  'End',
]);

export interface SeguimientoArbolFilaProps {
  asignacionId: string;
  nodo: MateriaNodo;
  /** Index among the visible rows of the tree. */
  indice: number;
  /** 0 for root materias. */
  profundidad: number;
  tieneHijos: boolean;
  expandido: boolean;
  rol: RolMateria;
  /** Progress row of an assigned materia. Undefined for context materias. */
  progreso: ProgresoFila | undefined;
  /** Aggregate of the branch (the materia and its descendants), over the whole tree. */
  agregado: Agregado | undefined;
  /** Whether the percentage of the branch is shown (the materia has children in the assignment). */
  mostrarPorcentajeRama: boolean;
  /** Edit mode. Read mode renders non-interactive indicators and no write controls. */
  editable: boolean;
  /** The materia whose detail is open. */
  seleccionada: boolean;
  /** Receives tab focus (roving tabindex: exactly one row of the tree). */
  tabulable: boolean;
  /** When it turns true the row moves DOM focus to itself (keyboard navigation). */
  enfocar: boolean;
  /** Trimmed search text applied to the tree. Empty when no search is active. */
  consulta: string;
  /** Whether this materia matches the search text. */
  coincide: boolean;
  onAbrirDetalle: (materiaId: string) => void;
  onAlternar: (materiaId: string) => void;
  /**
   * Toggles the coverage of the materia and its branch (parent / child cascade). Stable
   * callback; only used in edit mode.
   */
  onAlternarCobertura: (materiaId: string) => void;
  onTecla: (indice: number, tecla: TeclaArbol) => void;
  /** The row received DOM focus (updates the roving tabindex). */
  onEnfocada: (materiaId: string) => void;
}

interface FilaContenidoProps extends SeguimientoArbolFilaProps {
  /** Sets the covered date. Undefined when the row cannot be edited. */
  onFecha: ((fecha: string) => void) | undefined;
}

function FilaContenido({
  nodo,
  indice,
  profundidad,
  tieneHijos,
  expandido,
  rol,
  progreso,
  agregado,
  mostrarPorcentajeRama,
  editable,
  seleccionada,
  tabulable,
  enfocar,
  consulta,
  coincide,
  onAbrirDetalle,
  onAlternar,
  onAlternarCobertura,
  onTecla,
  onEnfocada,
  onFecha,
}: FilaContenidoProps) {
  const t = useTranslations('cedularios.seguimiento.revision.fila');
  const elemento = useRef<HTMLDivElement | null>(null);

  const esContexto = rol === 'contexto';
  const cubierta = progreso?.estado === 'cubierta';
  // Checkbox of the branch: assigned rows, and context rows with assigned descendants (derived
  // from the aggregate, a click acts on the descendants).
  const conCheck = !esContexto || (agregado?.total ?? 0) > 0;
  const estadoCheck = estadoVisual(agregado);
  const onToggle = editable && conCheck ? () => onAlternarCobertura(nodo.id) : undefined;

  useEffect(() => {
    if (enfocar) elemento.current?.focus();
  }, [enfocar]);

  const segmentosCodigo = useMemo(
    () => (coincide ? resaltar(nodo.codigo, consulta) : null),
    [coincide, nodo.codigo, consulta],
  );
  const segmentosNombre = useMemo(
    () => (coincide ? resaltar(nodo.nombre, consulta) : null),
    [coincide, nodo.nombre, consulta],
  );

  const porcentajeRama = agregado ? calcularPorcentaje(agregado.cubiertas, agregado.total) : null;

  const activar = () => {
    if (esContexto) {
      if (tieneHijos) onAlternar(nodo.id);
      return;
    }
    onAbrirDetalle(nodo.id);
  };

  const manejarTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    // Keys typed inside a child control (date input, buttons) are not row shortcuts.
    if (e.target !== e.currentTarget) return;
    if (e.key === ' ') {
      e.preventDefault();
      onToggle?.();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      activar();
      return;
    }
    if (TECLAS_ARBOL.has(e.key)) {
      e.preventDefault();
      onTecla(indice, e.key as TeclaArbol);
    }
  };

  return (
    <div
      ref={elemento}
      role="treeitem"
      aria-level={profundidad + 1}
      aria-expanded={tieneHijos ? expandido : undefined}
      aria-checked={conCheck ? ariaCheckedDe(estadoCheck) : undefined}
      aria-selected={seleccionada}
      tabIndex={tabulable ? 0 : -1}
      data-materia-id={nodo.id}
      data-indice={indice}
      onClick={activar}
      onKeyDown={manejarTecla}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onEnfocada(nodo.id);
      }}
      style={{ height: ALTURA_FILA, paddingLeft: 8 + profundidad * SANGRIA_POR_NIVEL }}
      className={cn(
        'box-border flex w-full items-center gap-1.5 border-b border-l-2 border-b-[var(--color-border)] pr-2 text-sm outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-gold)]',
        esContexto ? 'cursor-default' : 'cursor-pointer',
        seleccionada
          ? 'border-l-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
          : 'border-l-transparent hover:bg-[var(--color-bg-secondary)]',
        coincide && !seleccionada && 'bg-[var(--color-bg-secondary)]',
      )}
    >
      {tieneHijos ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t(expandido ? 'contraer' : 'expandir', { materia: nodo.nombre })}
          onClick={(e) => {
            e.stopPropagation();
            onAlternar(nodo.id);
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('size-4 transition-transform', expandido && 'rotate-90')}
          />
        </button>
      ) : (
        <span aria-hidden="true" className="size-7 shrink-0" />
      )}

      {conCheck ? (
        <ProgresoCheck
          estado={estadoCheck}
          rama={mostrarPorcentajeRama}
          materia={nodo.nombre}
          editable={editable}
          onToggle={onToggle}
          className={esContexto ? 'opacity-70' : undefined}
        />
      ) : (
        <span aria-hidden="true" className="size-5 shrink-0" />
      )}

      <div
        className={cn(
          'flex min-w-0 flex-1 items-baseline gap-2',
          esContexto && 'text-[var(--color-text-muted)] opacity-70',
        )}
        title={esContexto ? t('contexto') : undefined}
      >
        <span
          className={cn(
            'shrink-0 font-semibold',
            esContexto ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]',
          )}
        >
          {segmentosCodigo ? <Resaltado segmentos={segmentosCodigo} /> : nodo.codigo}
        </span>
        <span
          className={cn(
            'min-w-0 truncate',
            esContexto ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]',
          )}
          title={esContexto ? undefined : t('abrir_detalle', { materia: nodo.nombre })}
        >
          {segmentosNombre ? <Resaltado segmentos={segmentosNombre} /> : nodo.nombre}
        </span>
        {esContexto && <span className="sr-only">{t('contexto')}</span>}
      </div>

      {progreso && (
        <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
          {progreso.repasos > 0 && (
            <span
              role="img"
              aria-label={t('repasos', { count: progreso.repasos })}
              title={t('repasos', { count: progreso.repasos })}
              className="inline-flex items-center gap-0.5 tabular-nums"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              {progreso.repasos}
            </span>
          )}
          {progreso.notas !== null && progreso.notas.trim() !== '' && (
            <span
              role="img"
              aria-label={t('con_nota')}
              title={t('con_nota')}
              className="inline-flex items-center"
            >
              <StickyNote aria-hidden="true" className="size-3.5" />
            </span>
          )}
          {progreso.comentarios > 0 && (
            <span
              role="img"
              aria-label={t('comentarios', { count: progreso.comentarios })}
              title={t('comentarios', { count: progreso.comentarios })}
              className="inline-flex items-center gap-0.5 tabular-nums"
            >
              <MessageSquare aria-hidden="true" className="size-3.5" />
              {progreso.comentarios}
            </span>
          )}
          {progreso.clases > 0 && (
            <span
              role="img"
              aria-label={t('clases', { count: progreso.clases })}
              title={t('clases', { count: progreso.clases })}
              className="inline-flex items-center gap-0.5 tabular-nums"
            >
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {progreso.clases}
            </span>
          )}
        </span>
      )}

      {cubierta && progreso?.fechaCubierta && (
        <span className="hidden shrink-0 sm:block">
          <FechaCubiertaPicker
            value={progreso.fechaCubierta}
            materia={nodo.nombre}
            editable={editable}
            onChange={onFecha}
          />
        </span>
      )}

      {mostrarPorcentajeRama && (
        <span
          className="w-12 shrink-0 text-right text-xs"
          title={
            porcentajeRama === null
              ? t('sin_materias_rama')
              : t('porcentaje_rama', { porcentaje: formatearPorcentaje(porcentajeRama) })
          }
        >
          <PorcentajeTexto porcentaje={porcentajeRama} />
        </span>
      )}
    </div>
  );
}

/** Assigned row: owns the covered-date mutation of its progress row (coverage is a batch). */
function FilaAsignada(props: SeguimientoArbolFilaProps & { progreso: ProgresoFila }) {
  const { asignacionId, progreso, editable } = props;
  const { mutate } = useEstablecerEstadoMateria(asignacionId, progreso.id);

  const onFecha = useCallback(
    (fecha: string) => {
      mutate({ estado: 'cubierta', fecha });
    },
    [mutate],
  );

  return (
    <FilaContenido {...props} onFecha={editable ? onFecha : undefined} />
  );
}

function SeguimientoArbolFilaBase(props: SeguimientoArbolFilaProps) {
  const { rol, progreso } = props;
  if (rol === 'asignada' && progreso) return <FilaAsignada {...props} progreso={progreso} />;
  return <FilaContenido {...props} onFecha={undefined} />;
}

export const SeguimientoArbolFila = memo(SeguimientoArbolFilaBase);
