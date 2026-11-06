'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resaltar, type SegmentoTexto } from '@/lib/cedularios/busqueda';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import type { FilaVisible } from '@/lib/cedularios/tree';

/** Fixed height of every row in px (required by the virtualizer, Requirement 16.1). */
export const ALTURA_FILA = 40;

/** Indentation added per level of depth, in px. Also the horizontal step of a drag (task 10.7). */
export const SANGRIA_POR_NIVEL = 20;

/** Longest description excerpt shown in a row, in characters. */
const DESCRIPCION_MAX = 120;

export type DireccionNavegacion = 'siguiente' | 'anterior' | 'primero' | 'ultimo' | 'padre';

/** How a materia relates to the active search. */
export type TipoCoincidencia = 'ninguna' | 'texto' | 'temario';

export interface MateriaTreeRowProps {
  fila: FilaVisible;
  /** Index of the row among the visible rows (not the position among siblings). */
  indice: number;
  /** Number of active children. */
  numHijas: number;
  /** 1-based position among the active siblings (aria-posinset). */
  posicion: number;
  /** Number of active siblings, including this one (aria-setsize). */
  totalHermanas: number;
  seleccionada: boolean;
  /** Receives tab focus (roving tabindex: exactly one row of the tree). */
  tabulable: boolean;
  /** When it turns true the row moves DOM focus to itself (keyboard navigation). */
  enfocar: boolean;
  /** Trimmed, debounced search text. Empty when no search is active. */
  consulta: string;
  /**
   * `texto`: matches by código, nombre or descripción (segments are highlighted).
   * `temario`: matches only through its temario (no highlighted segments, Requirement 14.9).
   */
  coincidencia: TipoCoincidencia;
  /** Whether the user can edit. The base row has no edit controls; extensions read this. */
  puedeEditar: boolean;

  onSeleccionar: (id: string) => void;
  onAlternar: (id: string) => void;
  onNavegar: (indice: number, direccion: DireccionNavegacion) => void;
  /** The row received DOM focus (updates the roving tabindex). */
  onEnfocada: (id: string) => void;

  // ── Extension points (tasks 10.7 and 10.8) ────────────────────────────────
  /** Rendered before the chevron: the drag handle. Clicks and keys inside do not select the row. */
  inicio?: ReactNode;
  /** Replaces código + nombre (inline edit). Clicks inside still reach the row, stop them there. */
  contenido?: ReactNode;
  /** Rendered at the end of the row: the row menu. Clicks and keys inside do not select the row. */
  acciones?: ReactNode;
  /** Ref of the row element (dnd-kit `setNodeRef`). */
  rowRef?: Ref<HTMLDivElement>;
  /** Merged over the base style (dnd-kit `transform` / `transition`). */
  style?: CSSProperties;
  className?: string;
}

/** Sets a ref received from an extension (callback or object) to `el`. */
function asignarRefExterna(ref: Ref<HTMLDivElement> | undefined, el: HTMLDivElement | null): void {
  if (typeof ref === 'function') ref(el);
  else if (ref) (ref as { current: HTMLDivElement | null }).current = el;
}

// ---------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------

export function Resaltado({ segmentos }: { segmentos: SegmentoTexto[] }) {
  return (
    <>
      {segmentos.map((segmento, i) =>
        segmento.coincide ? (
          <mark
            key={i}
            className="rounded-sm bg-[var(--color-highlight)] px-0.5 text-[var(--color-highlight-foreground)]"
          >
            {segmento.texto}
          </mark>
        ) : (
          <span key={i}>{segmento.texto}</span>
        ),
      )}
    </>
  );
}

/**
 * Excerpt of `descripcion` around its first match, so the highlighted segment is visible in a
 * one-line row. Null when the descripción does not match.
 */
export function extractoDescripcion(descripcion: string, consulta: string): SegmentoTexto[] | null {
  const completos = resaltar(descripcion, consulta);
  let inicio = 0;
  let primero = -1;
  for (const segmento of completos) {
    if (segmento.coincide) {
      primero = inicio;
      break;
    }
    inicio += segmento.texto.length;
  }
  if (primero < 0) return null;
  if (descripcion.length <= DESCRIPCION_MAX) return completos;

  const desde = Math.max(0, primero - 40);
  const hasta = Math.min(descripcion.length, desde + DESCRIPCION_MAX);
  const extracto = `${desde > 0 ? '…' : ''}${descripcion.slice(desde, hasta)}${hasta < descripcion.length ? '…' : ''}`;
  return resaltar(extracto, consulta);
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

/**
 * One row of the materia tree (Requirements 4.9, 11.4, 14.9, 16.1).
 *
 * Fixed height (`ALTURA_FILA`), indentation by depth, expand/collapse chevron, código, nombre,
 * search highlight and treeitem semantics with a roving tabindex. It has no edit controls: the
 * drag handle, row menu and inline edit are plugged in through `inicio`, `acciones` and
 * `contenido`.
 *
 * Keyboard (when the row itself has focus): Enter/Space opens the materia, ArrowDown/ArrowUp move
 * between rows, ArrowRight expands (or goes to the first child), ArrowLeft collapses (or goes to
 * the parent), Home/End go to the first/last row.
 */
function MateriaTreeRowBase({
  fila,
  indice,
  numHijas,
  posicion,
  totalHermanas,
  seleccionada,
  tabulable,
  enfocar,
  consulta,
  coincidencia,
  puedeEditar,
  onSeleccionar,
  onAlternar,
  onNavegar,
  onEnfocada,
  inicio,
  contenido,
  acciones,
  rowRef,
  style,
  className,
}: MateriaTreeRowProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const { nodo, profundidad, tieneHijos, expandido } = fila;
  const elemento = useRef<HTMLDivElement | null>(null);

  const asignarRef = useCallback(
    (el: HTMLDivElement | null) => {
      elemento.current = el;
      asignarRefExterna(rowRef, el);
    },
    [rowRef],
  );

  useEffect(() => {
    if (enfocar) elemento.current?.focus();
  }, [enfocar]);

  const resaltarTexto = coincidencia === 'texto';
  const segmentosCodigo = useMemo(
    () => (resaltarTexto ? resaltar(nodo.codigo, consulta) : null),
    [resaltarTexto, nodo.codigo, consulta],
  );
  const segmentosNombre = useMemo(
    () => (resaltarTexto ? resaltar(nodo.nombre, consulta) : null),
    [resaltarTexto, nodo.nombre, consulta],
  );
  const segmentosDescripcion = useMemo(
    () => (resaltarTexto && nodo.descripcion ? extractoDescripcion(nodo.descripcion, consulta) : null),
    [resaltarTexto, nodo.descripcion, consulta],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys typed inside an extension (inline edit input, menu) are not row shortcuts.
    if (event.target !== event.currentTarget) return;
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSeleccionar(nodo.id);
        break;
      case 'ArrowDown':
        event.preventDefault();
        onNavegar(indice, 'siguiente');
        break;
      case 'ArrowUp':
        event.preventDefault();
        onNavegar(indice, 'anterior');
        break;
      case 'Home':
        event.preventDefault();
        onNavegar(indice, 'primero');
        break;
      case 'End':
        event.preventDefault();
        onNavegar(indice, 'ultimo');
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (tieneHijos && !expandido) onAlternar(nodo.id);
        else if (tieneHijos) onNavegar(indice, 'siguiente');
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (tieneHijos && expandido) onAlternar(nodo.id);
        else onNavegar(indice, 'padre');
        break;
      default:
        break;
    }
  };

  const detener = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

  return (
    <div
      ref={asignarRef}
      role="treeitem"
      aria-level={profundidad + 1}
      aria-posinset={posicion}
      aria-setsize={totalHermanas}
      aria-expanded={tieneHijos ? expandido : undefined}
      aria-selected={seleccionada}
      tabIndex={tabulable ? 0 : -1}
      data-materia-id={nodo.id}
      data-indice={indice}
      data-puede-editar={puedeEditar ? 'true' : undefined}
      onClick={() => onSeleccionar(nodo.id)}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onEnfocada(nodo.id);
      }}
      style={{ height: ALTURA_FILA, paddingLeft: 8 + profundidad * SANGRIA_POR_NIVEL, ...style }}
      className={cn(
        'box-border flex w-full cursor-pointer items-center gap-1 border-b border-l-2 border-b-[var(--color-border)] pr-2 text-sm outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-gold)]',
        seleccionada
          ? 'border-l-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
          : 'border-l-transparent hover:bg-[var(--color-bg-secondary)]',
        coincidencia !== 'ninguna' && !seleccionada && 'bg-[var(--color-bg-secondary)]',
        className,
      )}
    >
      {inicio && (
        <span className="flex shrink-0 items-center" onClick={detener} onKeyDown={detener}>
          {inicio}
        </span>
      )}

      {tieneHijos ? (
        <button
          type="button"
          tabIndex={-1}
          aria-expanded={expandido}
          aria-label={t(expandido ? 'estructura.contraer_aria' : 'estructura.expandir_aria', {
            nombre: nodo.nombre,
          })}
          title={t(expandido ? 'estructura.contraer' : 'estructura.expandir')}
          onClick={(event) => {
            event.stopPropagation();
            onAlternar(nodo.id);
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('size-4 transition-transform', expandido && 'rotate-90')}
          />
        </button>
      ) : (
        <span aria-hidden="true" className="size-7 shrink-0" />
      )}

      {contenido ?? (
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 font-semibold text-[var(--color-text-primary)]">
            {segmentosCodigo ? <Resaltado segmentos={segmentosCodigo} /> : nodo.codigo}
          </span>
          <span className="min-w-0 truncate text-[var(--color-text-primary)]" title={nodo.nombre}>
            {segmentosNombre ? <Resaltado segmentos={segmentosNombre} /> : nodo.nombre}
          </span>
          {segmentosDescripcion && (
            <span className="hidden min-w-0 shrink truncate text-xs text-[var(--color-text-muted)] md:inline">
              <Resaltado segmentos={segmentosDescripcion} />
            </span>
          )}
        </div>
      )}

      {coincidencia === 'temario' && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs text-[var(--color-text-primary)]">
          <Search aria-hidden="true" className="size-3" />
          {t('estructura.coincide_temario')}
        </span>
      )}

      {tieneHijos && (
        <span className="hidden shrink-0 text-xs text-[var(--color-text-muted)] lg:inline">
          {t('estructura.hijas', { count: numHijas })}
        </span>
      )}

      {acciones && (
        <span className="flex shrink-0 items-center" onClick={detener} onKeyDown={detener}>
          {acciones}
        </span>
      )}
    </div>
  );
}

export const MateriaTreeRow = memo(MateriaTreeRowBase);
