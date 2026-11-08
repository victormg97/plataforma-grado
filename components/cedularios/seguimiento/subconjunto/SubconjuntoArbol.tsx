'use client';

/**
 * Checkbox tree of the active materias of a cedulario, used to pick the subset assigned to a
 * student. Shared by the subset edit view and the assignment dialog.
 *
 * - One native checkbox per materia (checked = in the selection). Checking a materia never
 *   changes its descendants.
 * - "Select branch" / "Remove branch" add or remove the materia and all its active descendants.
 * - Materias that already hold progress data show a "has recorded progress" marker.
 * - The component is controlled: it only emits the new selection as a set of ids.
 * - Keyboard: roving tabindex on the checkboxes, arrows move and expand/collapse (siguienteFoco).
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aplanarVisibles, type FilaVisible, type MateriaNodo } from '@/lib/cedularios/tree';
import { ramaActiva } from '@/lib/cedularios/seguimiento/subconjunto';
import {
  siguienteFoco,
  type FilaNavegable,
  type TeclaArbol,
} from '@/lib/cedularios/seguimiento/tree-nav';

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

export interface SubconjuntoArbolProps {
  /** Full flat structure of the cedulario. Inactive materias are ignored. */
  flat: MateriaNodo[];
  /** Ids of the currently selected (assigned) materias. */
  seleccion: ReadonlySet<string>;
  /** Receives a new set every time the selection changes. */
  onChange: (seleccion: Set<string>) => void;
  /** Ids of materias that hold progress data (shows the "has recorded progress" marker). */
  conAvance?: ReadonlySet<string>;
  disabled?: boolean;
  /** Ids of the collapsed materias. Optional: without it the tree keeps its own state. */
  colapsados?: ReadonlySet<string>;
  /** Receives the new collapsed set. Needed together with `colapsados`. */
  onColapsadosChange?: (colapsados: Set<string>) => void;
  className?: string;
}

/** Selected and total active materias of the branch rooted at each active materia. */
interface ConteoRama {
  seleccionadas: number;
  total: number;
}

function contarRamas(
  flat: MateriaNodo[],
  seleccion: ReadonlySet<string>,
): Map<string, ConteoRama> {
  const hijos = new Map<string | null, MateriaNodo[]>();
  for (const n of flat) {
    if (!n.activo) continue;
    const lista = hijos.get(n.parentId);
    if (lista) lista.push(n);
    else hijos.set(n.parentId, [n]);
  }

  const conteos = new Map<string, ConteoRama>();
  const visitados = new Set<string>();
  const visitar = (nodo: MateriaNodo): ConteoRama => {
    const previo = conteos.get(nodo.id);
    if (previo) return previo;
    // Guard against a cycle in corrupt data: a node already in progress counts as empty.
    if (visitados.has(nodo.id)) return { seleccionadas: 0, total: 0 };
    visitados.add(nodo.id);
    const conteo: ConteoRama = { seleccionadas: seleccion.has(nodo.id) ? 1 : 0, total: 1 };
    for (const h of hijos.get(nodo.id) ?? []) {
      const c = visitar(h);
      conteo.seleccionadas += c.seleccionadas;
      conteo.total += c.total;
    }
    conteos.set(nodo.id, conteo);
    return conteo;
  };

  for (const raiz of hijos.get(null) ?? []) visitar(raiz);
  return conteos;
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface FilaProps {
  fila: FilaVisible;
  seleccionada: boolean;
  conAvance: boolean;
  /** Whole branch already selected: "Select branch" has nothing to do. */
  ramaCompleta: boolean;
  /** Nothing selected in the branch: "Remove branch" has nothing to do. */
  ramaVacia: boolean;
  /** Roving tabindex: exactly one row of the tree is tabbable. */
  tabulable: boolean;
  disabled: boolean;
  registrarCasilla: (id: string, el: HTMLInputElement | null) => void;
  onAlternarSeleccion: (id: string) => void;
  onAlternarExpansion: (id: string) => void;
  onSeleccionarRama: (id: string) => void;
  onQuitarRama: (id: string) => void;
  onEnfocada: (id: string) => void;
}

const SubconjuntoFila = memo(function SubconjuntoFila({
  fila,
  seleccionada,
  conAvance,
  ramaCompleta,
  ramaVacia,
  tabulable,
  disabled,
  registrarCasilla,
  onAlternarSeleccion,
  onAlternarExpansion,
  onSeleccionarRama,
  onQuitarRama,
  onEnfocada,
}: FilaProps) {
  const t = useTranslations('cedularios.seguimiento');
  const { nodo, profundidad, tieneHijos, expandido } = fila;

  const botonRama =
    'rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-primary)] ' +
    'hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] ' +
    'disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      role="treeitem"
      aria-level={profundidad + 1}
      aria-expanded={tieneHijos ? expandido : undefined}
      aria-selected={seleccionada}
      style={{ paddingLeft: 8 + profundidad * SANGRIA_POR_NIVEL }}
      className={cn(
        'box-border flex min-h-10 w-full items-center gap-1 border-b border-l-2 border-b-[var(--color-border)] pr-2 text-sm',
        seleccionada
          ? 'border-l-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
          : 'border-l-transparent',
      )}
    >
      {tieneHijos ? (
        <button
          type="button"
          tabIndex={-1}
          aria-expanded={expandido}
          aria-label={t(expandido ? 'revision.fila.contraer' : 'revision.fila.expandir', {
            materia: nodo.nombre,
          })}
          onClick={() => onAlternarExpansion(nodo.id)}
          className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('size-4 transition-transform', expandido && 'rotate-90')}
          />
        </button>
      ) : (
        <span aria-hidden="true" className="size-7 shrink-0" />
      )}

      <input
        ref={(el) => registrarCasilla(nodo.id, el)}
        type="checkbox"
        data-materia-id={nodo.id}
        checked={seleccionada}
        disabled={disabled}
        tabIndex={tabulable ? 0 : -1}
        aria-label={t('subconjunto.casilla_aria', { materia: nodo.nombre })}
        onChange={() => onAlternarSeleccion(nodo.id)}
        onFocus={() => onEnfocada(nodo.id)}
        className="size-4 shrink-0 cursor-pointer accent-[var(--color-brand-gold)] disabled:cursor-not-allowed"
      />

      <div className="flex min-w-0 flex-1 items-baseline gap-2 pl-1">
        <span className="shrink-0 font-semibold text-[var(--color-text-primary)]">{nodo.codigo}</span>
        <span className="min-w-0 truncate text-[var(--color-text-primary)]" title={nodo.nombre}>
          {nodo.nombre}
        </span>
      </div>

      {conAvance && (
        <span
          title={t('subconjunto.con_avance')}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs text-[var(--color-text-primary)]"
        >
          <ClipboardCheck aria-hidden="true" className="size-3" />
          <span className="hidden sm:inline">{t('subconjunto.con_avance')}</span>
          <span className="sr-only sm:hidden">{t('subconjunto.con_avance')}</span>
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          tabIndex={tabulable ? 0 : -1}
          disabled={disabled || ramaCompleta}
          aria-label={t('subconjunto.seleccionar_rama_aria', { materia: nodo.nombre })}
          onClick={() => onSeleccionarRama(nodo.id)}
          className={botonRama}
        >
          {t('subconjunto.seleccionar_rama')}
        </button>
        <button
          type="button"
          tabIndex={tabulable ? 0 : -1}
          disabled={disabled || ramaVacia}
          aria-label={t('subconjunto.quitar_rama_aria', { materia: nodo.nombre })}
          onClick={() => onQuitarRama(nodo.id)}
          className={botonRama}
        >
          {t('subconjunto.quitar_rama')}
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

export function SubconjuntoArbol({
  flat,
  seleccion,
  onChange,
  conAvance,
  disabled = false,
  colapsados: colapsadosControlados,
  onColapsadosChange,
  className,
}: SubconjuntoArbolProps) {
  const t = useTranslations('cedularios.seguimiento');

  // Everything starts expanded: the user must see which materias are selected.
  const [colapsadosPropios, setColapsadosPropios] = useState<ReadonlySet<string>>(() => new Set());
  const controlado = colapsadosControlados !== undefined && onColapsadosChange !== undefined;
  const colapsados = controlado ? colapsadosControlados : colapsadosPropios;
  const colapsadosRef = useRef(colapsados);
  const onColapsadosChangeRef = useRef(onColapsadosChange);
  const [focoId, setFocoId] = useState<string | null>(null);
  const casillas = useRef(new Map<string, HTMLInputElement>());

  // Stable handlers read the latest props through refs, so memoized rows do not re-render
  // because of a new function identity.
  const seleccionRef = useRef(seleccion);
  const flatRef = useRef(flat);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    seleccionRef.current = seleccion;
    flatRef.current = flat;
    onChangeRef.current = onChange;
    colapsadosRef.current = colapsados;
    onColapsadosChangeRef.current = onColapsadosChange;
  });

  const expandidos = useMemo(() => {
    const ids = new Set<string>();
    for (const n of flat) {
      if (n.activo && !colapsados.has(n.id)) ids.add(n.id);
    }
    return ids;
  }, [flat, colapsados]);

  const filas = useMemo(() => aplanarVisibles(flat, expandidos), [flat, expandidos]);
  const conteos = useMemo(() => contarRamas(flat, seleccion), [flat, seleccion]);

  // The tabbable row is the focused one if still visible, otherwise the first row.
  const tabulableId = useMemo(() => {
    if (focoId !== null && filas.some((f) => f.nodo.id === focoId)) return focoId;
    return filas[0]?.nodo.id ?? null;
  }, [filas, focoId]);

  const registrarCasilla = useCallback((id: string, el: HTMLInputElement | null) => {
    if (el) casillas.current.set(id, el);
    else casillas.current.delete(id);
  }, []);

  const onAlternarSeleccion = useCallback((id: string) => {
    const siguiente = new Set(seleccionRef.current);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    onChangeRef.current(siguiente);
  }, []);

  const onSeleccionarRama = useCallback((id: string) => {
    const siguiente = new Set(seleccionRef.current);
    for (const rama of ramaActiva(flatRef.current, id)) siguiente.add(rama);
    onChangeRef.current(siguiente);
  }, []);

  const onQuitarRama = useCallback((id: string) => {
    const siguiente = new Set(seleccionRef.current);
    for (const rama of ramaActiva(flatRef.current, id)) siguiente.delete(rama);
    onChangeRef.current(siguiente);
  }, []);

  const onAlternarExpansion = useCallback((id: string) => {
    const alternar = (previo: ReadonlySet<string>) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    };
    const cambio = onColapsadosChangeRef.current;
    if (cambio) cambio(alternar(colapsadosRef.current));
    else setColapsadosPropios(alternar);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const objetivo = event.target;
    if (!(objetivo instanceof HTMLInputElement)) return;
    const id = objetivo.dataset.materiaId;
    if (!id || !TECLAS_ARBOL.has(event.key)) return;

    const indice = filas.findIndex((f) => f.nodo.id === id);
    if (indice < 0) return;

    const navegables: FilaNavegable[] = filas.map((f) => ({
      id: f.nodo.id,
      tieneHijos: f.tieneHijos,
      expandido: f.expandido,
      parentId: f.nodo.parentId,
    }));
    const resultado = siguienteFoco(navegables, indice, event.key as TeclaArbol);
    event.preventDefault();

    if (resultado.accion === 'expandir' || resultado.accion === 'contraer') {
      onAlternarExpansion(id);
      return;
    }
    const destino = filas[resultado.indice];
    if (destino) casillas.current.get(destino.nodo.id)?.focus();
  };

  return (
    <div
      role="tree"
      aria-label={t('subconjunto.arbol_aria')}
      aria-multiselectable="true"
      onKeyDown={onKeyDown}
      className={cn(
        'overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
        className,
      )}
    >
      {filas.map((fila) => {
        const conteo = conteos.get(fila.nodo.id);
        return (
          <SubconjuntoFila
            key={fila.nodo.id}
            fila={fila}
            seleccionada={seleccion.has(fila.nodo.id)}
            conAvance={conAvance?.has(fila.nodo.id) ?? false}
            ramaCompleta={conteo ? conteo.seleccionadas === conteo.total : false}
            ramaVacia={conteo ? conteo.seleccionadas === 0 : true}
            tabulable={fila.nodo.id === tabulableId}
            disabled={disabled}
            registrarCasilla={registrarCasilla}
            onAlternarSeleccion={onAlternarSeleccion}
            onAlternarExpansion={onAlternarExpansion}
            onSeleccionarRama={onSeleccionarRama}
            onQuitarRama={onQuitarRama}
            onEnfocada={setFocoId}
          />
        );
      })}
    </div>
  );
}
