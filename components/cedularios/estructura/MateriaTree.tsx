'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslations } from 'next-intl';
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { buscarMateriasTemario } from '@/app/actions/cedularios/materias';
import { SEARCH_MAX_LENGTH, buscarEnArbol } from '@/lib/cedularios/busqueda';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import { aplanarVisibles, conteoPorNivel, descendientes, type FilaVisible, type MateriaNodo } from '@/lib/cedularios/tree';
import type { MateriaEstructura } from '@/lib/queries/cedularios/materias';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useMateriasTree } from '../hooks/useMaterias';
import {
  ALTURA_FILA,
  MateriaTreeRow,
  type DireccionNavegacion,
  type MateriaTreeRowProps,
  type TipoCoincidencia,
} from './MateriaTreeRow';

/** Above this number of ACTIVE materias the tree uses virtual scrolling (Requirement 16.1, 16.9). */
export const UMBRAL_VIRTUALIZACION = 100;

/** Rows mounted above and below the viewport when virtualized (Requirement 16.1). */
export const OVERSCAN_FILAS = 20;

const NIVELES = [1, 2, 3, 4, 5] as const;
const SIN_MATERIAS: MateriaEstructura[] = [];
const SIN_IDS: ReadonlySet<string> = new Set<string>();

/** Ids of the materia id and of its active descendants that have at least one active child. */
function idsConHijos(flat: MateriaNodo[], id: string): string[] {
  const conHijos = new Set<string>();
  for (const n of flat) if (n.activo && n.parentId !== null) conHijos.add(n.parentId);
  return [id, ...descendientes(flat, id).map((n) => n.id)].filter((x) => conHijos.has(x));
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Imperative API for the parts that edit the tree (task 10.8). */
export interface MateriaTreeHandle {
  /** Expands a materia (for example the parent of a newly added child). Local state only. */
  expandir: (id: string) => void;
  /** Expands a materia and every descendant that has children, all the way down. Local state only. */
  expandirTodo: (id: string) => void;
  /** Collapses a materia and all its descendants. Local state only. */
  contraerTodo: (id: string) => void;
  /** True when the materia and every descendant with children are expanded (leaves count as expanded). */
  subarbolExpandido: (id: string) => boolean;
  /** Scrolls the row of a materia into view when it is currently visible in the tree. */
  scrollAMateria: (id: string) => void;
}

export interface MateriaTreeProps {
  cedularioId: string;
  /** Whether the user can edit. The tree itself has no edit controls: it gates the slots below. */
  puedeEditar: boolean;
  /**
   * Index (in the visible rows) that the virtualizer must keep mounted even when it is outside
   * the viewport: the row being dragged (task 10.7). Ignored in plain DOM mode.
   */
  indiceSiempreMontado?: number | null;
  /**
   * Toolbar slot for the "Add materia" button (task 10.8). Rendered only when `puedeEditar`
   * is true, so read-only users never see edit controls (Requirement 11.13).
   */
  accionesToolbar?: ReactNode;
  /**
   * Replaces how a row is rendered (task 10.7 uses it to call `useSortable` and pass the drag
   * handle, menu and style to `MateriaTreeRow`). Defaults to `<MateriaTreeRow {...props} />`.
   * Must return an element whose root is the row (the tree already provides the list wrapper).
   */
  renderFila?: (props: MateriaTreeRowProps) => ReactNode;
  /**
   * Wraps the list of rows (inside the tree card, outside the scroll container): the place for
   * `SortableContext` with the ids of `filas`. A `DndContext` can wrap `<MateriaTree>` itself.
   */
  envolverLista?: (lista: ReactNode, filas: FilaVisible[]) => ReactNode;
  ref?: Ref<MateriaTreeHandle>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * `rangeExtractor` for the virtualizer: the default range (visible rows plus overscan), plus
 * `indice` when it is a valid row outside that range. Keeps the dragged row mounted.
 */
export function rangeExtractorConIndice(indice: number | null | undefined) {
  return (range: Range): number[] => {
    const base = defaultRangeExtractor(range);
    if (indice === null || indice === undefined) return base;
    if (indice < 0 || indice >= range.count || base.includes(indice)) return base;
    return [...base, indice].sort((a, b) => a - b);
  };
}

interface InfoHermanos {
  posicion: number;
  totalHermanas: number;
  numHijas: number;
}

/** Position among active siblings and number of active children, for aria and the row info. */
function indexarHermanos(flat: MateriaNodo[]): Map<string, InfoHermanos> {
  const activos = flat
    .filter((n) => n.activo)
    .sort((a, b) => (a.orden !== b.orden ? (a.orden < b.orden ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const tamano = new Map<string | null, number>();
  for (const n of activos) tamano.set(n.parentId, (tamano.get(n.parentId) ?? 0) + 1);

  const vistos = new Map<string | null, number>();
  const info = new Map<string, InfoHermanos>();
  for (const n of activos) {
    const posicion = (vistos.get(n.parentId) ?? 0) + 1;
    vistos.set(n.parentId, posicion);
    info.set(n.id, {
      posicion,
      totalHermanas: tamano.get(n.parentId) ?? 1,
      numHijas: tamano.get(n.id) ?? 0,
    });
  }
  return info;
}

// ---------------------------------------------------------------------------
// Lists (plain DOM and virtualized)
// ---------------------------------------------------------------------------

interface ListaHandle {
  scrollAIndice: (indice: number) => void;
}

interface ListaProps {
  filas: FilaVisible[];
  etiqueta: string;
  renderFila: (fila: FilaVisible, indice: number) => ReactNode;
  ref?: Ref<ListaHandle>;
}

/** 100 or fewer active materias: every visible row is in the DOM (Requirement 16.9). */
function ListaPlana({ filas, etiqueta, renderFila, ref }: ListaProps) {
  const contenedor = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      scrollAIndice: (indice) => {
        contenedor.current
          ?.querySelector<HTMLElement>(`[data-indice="${indice}"]`)
          ?.scrollIntoView({ block: 'nearest' });
      },
    }),
    [],
  );

  return (
    <div
      ref={contenedor}
      role="tree"
      aria-label={etiqueta}
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]"
    >
      {filas.map((fila, indice) => (
        <Fragment key={fila.nodo.id}>{renderFila(fila, indice)}</Fragment>
      ))}
    </div>
  );
}

interface ListaVirtualProps extends ListaProps {
  indiceSiempreMontado: number | null | undefined;
}

/** More than 100 active materias: fixed-height rows, overscan 20 (Requirement 16.1). */
function ListaVirtual({ filas, etiqueta, renderFila, indiceSiempreMontado, ref }: ListaVirtualProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const rangeExtractor = useMemo(
    () => rangeExtractorConIndice(indiceSiempreMontado),
    [indiceSiempreMontado],
  );

  // React Compiler skips memoizing this component, which is the intended behavior for TanStack Virtual.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedor.current,
    estimateSize: () => ALTURA_FILA,
    overscan: OVERSCAN_FILAS,
    rangeExtractor,
    getItemKey: (indice) => filas[indice]?.nodo.id ?? indice,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollAIndice: (indice) => virtualizer.scrollToIndex(indice, { align: 'auto' }),
    }),
    [virtualizer],
  );

  return (
    <div
      ref={contenedor}
      className="max-h-[70vh] overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]"
    >
      <div
        role="tree"
        aria-label={etiqueta}
        style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const fila = filas[item.index];
          if (!fila) return null;
          return (
            <div
              key={item.key}
              role="presentation"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ALTURA_FILA,
                transform: `translateY(${item.start}px)`,
              }}
            >
              {renderFila(fila, item.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

/**
 * Hierarchical structure of a cedulario: per-nivel counts, search, and the tree
 * (Requirements 4.9, 4.13, 11.4, 11.11, 11.13, 12.15, 14.3, 14.6 to 14.13, 16.1, 16.2, 16.9).
 *
 * The flat structure loads once (`useMateriasTree`). Expanding and collapsing is local state and
 * never issues a request. Every materia with children starts collapsed.
 *
 * Search decision: the whole tree stays rendered. While a search is active, every ancestor of
 * every match is expanded (merged with the user's own expansion), matched text is highlighted,
 * and the first match is scrolled into view. Clearing the search resets the tree to all collapsed
 * (Requirement 14.10).
 */
export function MateriaTree({ cedularioId, ...props }: MateriaTreeProps) {
  // `key` resets expansion, focus and search results when another cedulario is shown.
  return <MateriaTreeContenido key={cedularioId} cedularioId={cedularioId} {...props} />;
}

function MateriaTreeContenido({
  cedularioId,
  puedeEditar,
  indiceSiempreMontado,
  accionesToolbar,
  renderFila: renderFilaPersonalizada,
  envolverLista,
  ref,
}: MateriaTreeProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const { run, translateError } = useCedulariosAction();
  const { q, setQ, materiaId, setMateriaId } = useCedulariosUrl();
  const consultaEstructura = useMateriasTree(cedularioId);
  const flat = consultaEstructura.data ?? SIN_MATERIAS;

  // ── Counts and virtualization mode ────────────────────────────────────────
  const conteo = useMemo(() => conteoPorNivel(flat), [flat]);
  const totalActivas = NIVELES.reduce((suma, nivel) => suma + conteo[nivel], 0);
  const hayMaterias = totalActivas > 0;
  const virtualizar = totalActivas > UMBRAL_VIRTUALIZACION;
  const infoHermanos = useMemo(() => indexarHermanos(flat), [flat]);

  // ── Search: typed text (URL, immediate) vs applied text (debounced) ───────
  const textoEscrito = q.slice(0, SEARCH_MAX_LENGTH);
  const textoRetrasado = useDebouncedValue(textoEscrito);
  // Clearing applies at once; a non-empty search waits for the 300 ms debounce (Requirement 14.3).
  const textoActivo = textoEscrito.trim() === '' ? '' : textoRetrasado.trim();
  const buscando = textoActivo !== '' && hayMaterias;
  const entradaBusqueda = useRef<HTMLInputElement>(null);

  // Server temario search, once per applied query. The result is only used while its key is the
  // current one, so a late answer for an older query is ignored.
  const claveTemario = buscando ? `${cedularioId}\u0000${textoActivo}` : '';
  const [resultadoTemario, setResultadoTemario] = useState<{
    clave: string;
    ids: ReadonlySet<string>;
    error: boolean;
  } | null>(null);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    if (claveTemario === '') return;
    let cancelado = false;
    void runRef
      .current(() => buscarMateriasTemario(cedularioId, textoActivo), { skipErrorToast: true })
      .then((resultado) => {
        if (cancelado) return;
        setResultadoTemario(
          resultado.ok
            ? { clave: claveTemario, ids: new Set(resultado.data), error: false }
            : { clave: claveTemario, ids: SIN_IDS, error: true },
        );
      });
    return () => {
      cancelado = true;
    };
  }, [claveTemario, cedularioId, textoActivo]);

  const temarioVigente = resultadoTemario?.clave === claveTemario ? resultadoTemario : null;
  const cargandoTemario = buscando && temarioVigente === null;
  const errorTemario = buscando && temarioVigente?.error === true;
  const idsTemario = temarioVigente && !temarioVigente.error ? temarioVigente.ids : SIN_IDS;

  const busquedaLocal = useMemo(
    () => (buscando ? buscarEnArbol(flat, textoActivo, SIN_IDS) : null),
    [buscando, flat, textoActivo],
  );
  const busqueda = useMemo(
    () => (buscando ? buscarEnArbol(flat, textoActivo, idsTemario) : null),
    [buscando, flat, textoActivo, idsTemario],
  );

  // ── Expansion (local state, never a request) ──────────────────────────────
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(SIN_IDS);
  const [claveAplicada, setClaveAplicada] = useState('');
  const claveExpansion = busqueda ? `${textoActivo}\u0000${[...busqueda.expandir].sort().join(',')}` : '';
  if (claveExpansion !== claveAplicada) {
    // Adjusting state while rendering: the rows below already use the new expansion.
    setClaveAplicada(claveExpansion);
    if (busqueda === null) {
      // Search cleared: default collapsed state (Requirement 14.10).
      setExpandidos(SIN_IDS);
    } else {
      const ancestros = busqueda.expandir;
      setExpandidos((previo) => new Set([...previo, ...ancestros]));
    }
  }

  const filas = useMemo(() => aplanarVisibles(flat, expandidos), [flat, expandidos]);
  const filasRef = useRef(filas);
  useEffect(() => {
    filasRef.current = filas;
  }, [filas]);

  // ── Focus (roving tabindex) and navigation ────────────────────────────────
  const [focoId, setFocoId] = useState<string | null>(null);
  const [enfocarId, setEnfocarId] = useState<string | null>(null);
  const listaRef = useRef<ListaHandle>(null);

  const idTabulable = useMemo(() => {
    if (focoId && filas.some((f) => f.nodo.id === focoId)) return focoId;
    if (materiaId && filas.some((f) => f.nodo.id === materiaId)) return materiaId;
    return filas[0]?.nodo.id ?? null;
  }, [filas, focoId, materiaId]);

  const seleccionar = useCallback((id: string) => setMateriaId(id), [setMateriaId]);

  const alternar = useCallback((id: string) => {
    setExpandidos((previo) => {
      const siguiente = new Set(previo);
      if (!siguiente.delete(id)) siguiente.add(id);
      return siguiente;
    });
  }, []);

  const enfocada = useCallback((id: string) => {
    setFocoId(id);
    setEnfocarId(null);
  }, []);

  const navegar = useCallback((indice: number, direccion: DireccionNavegacion) => {
    const visibles = filasRef.current;
    if (visibles.length === 0) return;
    let destino = indice;
    switch (direccion) {
      case 'siguiente':
        destino = Math.min(indice + 1, visibles.length - 1);
        break;
      case 'anterior':
        destino = Math.max(indice - 1, 0);
        break;
      case 'primero':
        destino = 0;
        break;
      case 'ultimo':
        destino = visibles.length - 1;
        break;
      case 'padre': {
        const profundidad = visibles[indice]?.profundidad ?? 0;
        if (profundidad === 0) return;
        destino = indice - 1;
        while (destino >= 0 && visibles[destino].profundidad >= profundidad) destino -= 1;
        break;
      }
    }
    if (destino < 0 || destino === indice || !visibles[destino]) return;
    listaRef.current?.scrollAIndice(destino);
    setEnfocarId(visibles[destino].nodo.id);
  }, []);

  // The first match is scrolled into view when a search is applied or its expansion changes.
  useEffect(() => {
    if (claveAplicada === '') return;
    const primera = filasRef.current.findIndex((f) => busqueda?.coincidencias.has(f.nodo.id));
    if (primera >= 0) listaRef.current?.scrollAIndice(primera);
    // Only when the applied expansion changes; `busqueda` is read for the current matches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveAplicada]);

  useImperativeHandle(
    ref,
    () => ({
      expandir: (id) =>
        setExpandidos((previo) => (previo.has(id) ? previo : new Set(previo).add(id))),
      expandirTodo: (id) => {
        const ramas = idsConHijos(flat, id);
        setExpandidos((previo) => new Set([...previo, ...ramas]));
      },
      contraerTodo: (id) => {
        const ramas = idsConHijos(flat, id);
        setExpandidos((previo) => {
          const siguiente = new Set(previo);
          for (const rama of ramas) siguiente.delete(rama);
          return siguiente;
        });
      },
      subarbolExpandido: (id) => idsConHijos(flat, id).every((rama) => expandidos.has(rama)),
      scrollAMateria: (id) => {
        const indice = filasRef.current.findIndex((f) => f.nodo.id === id);
        if (indice >= 0) listaRef.current?.scrollAIndice(indice);
      },
    }),
    [flat, expandidos],
  );

  // ── Rendering ─────────────────────────────────────────────────────────────
  const renderItem = (fila: FilaVisible, indice: number): ReactNode => {
    const id = fila.nodo.id;
    const info = infoHermanos.get(id);
    let coincidencia: TipoCoincidencia = 'ninguna';
    if (busqueda && busquedaLocal) {
      if (busquedaLocal.coincidencias.has(id)) coincidencia = 'texto';
      else if (busqueda.coincidencias.has(id)) coincidencia = 'temario';
    }
    const propsFila: MateriaTreeRowProps = {
      fila,
      indice,
      numHijas: info?.numHijas ?? 0,
      posicion: info?.posicion ?? 1,
      totalHermanas: info?.totalHermanas ?? 1,
      seleccionada: id === materiaId,
      tabulable: id === idTabulable,
      enfocar: id === enfocarId,
      consulta: textoActivo,
      coincidencia,
      puedeEditar,
      onSeleccionar: seleccionar,
      onAlternar: alternar,
      onNavegar: navegar,
      onEnfocada: enfocada,
    };
    return renderFilaPersonalizada ? renderFilaPersonalizada(propsFila) : <MateriaTreeRow {...propsFila} />;
  };

  const etiquetaArbol = t('estructura.titulo');
  const lista = virtualizar ? (
    <ListaVirtual
      ref={listaRef}
      filas={filas}
      etiqueta={etiquetaArbol}
      renderFila={renderItem}
      indiceSiempreMontado={indiceSiempreMontado}
    />
  ) : (
    <ListaPlana ref={listaRef} filas={filas} etiqueta={etiquetaArbol} renderFila={renderItem} />
  );

  let cuerpo: ReactNode;
  if (consultaEstructura.isPending) {
    cuerpo = (
      <div role="status" aria-live="polite" className="space-y-2">
        <span className="sr-only">{t('estructura.cargando')}</span>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          />
        ))}
      </div>
    );
  } else if (consultaEstructura.isError && consultaEstructura.data === undefined) {
    cuerpo = (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
      >
        <p className="text-sm text-[var(--color-error)]">
          {translateError({ code: codigoDeError(consultaEstructura.error) })}
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={consultaEstructura.isFetching}
          onClick={() => void consultaEstructura.refetch()}
        >
          {t('comun.reintentar')}
        </Button>
      </div>
    );
  } else if (!hayMaterias) {
    cuerpo = (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('estructura.vacio')}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {puedeEditar ? t('estructura.vacio_descripcion') : t('estructura.vacio_lector')}
        </p>
      </div>
    );
  } else {
    cuerpo = envolverLista ? envolverLista(lista, filas) : lista;
  }

  const cargado = !consultaEstructura.isPending && consultaEstructura.data !== undefined;

  return (
    <section aria-labelledby={`estructura-titulo-${cedularioId}`} className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3
          id={`estructura-titulo-${cedularioId}`}
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          {t('estructura.titulo')}
        </h3>
        {/* Slot for the "Add materia" button (task 10.8). Hidden in read-only mode. */}
        {puedeEditar && accionesToolbar ? (
          <div className="flex flex-wrap items-center gap-2">{accionesToolbar}</div>
        ) : null}
      </header>

      {cargado && (
        <ul
          aria-label={t('estructura.conteo_titulo')}
          className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]"
        >
          {NIVELES.map((nivel) => (
            <li
              key={nivel}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2.5 py-1"
            >
              <span className="font-medium text-[var(--color-text-primary)]">
                {t('estructura.nivel', { nivel })}
              </span>
              <span>{t('estructura.conteo_nivel', { count: conteo[nivel] })}</span>
            </li>
          ))}
          <li className="inline-flex items-center rounded-full border border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] px-2.5 py-1 text-[var(--color-text-primary)]">
            {t('estructura.conteo_total', { count: totalActivas })}
          </li>
        </ul>
      )}

      {cargado && hayMaterias && (
        <div className="space-y-1.5">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <Input
              ref={entradaBusqueda}
              type="text"
              inputMode="search"
              autoComplete="off"
              maxLength={SEARCH_MAX_LENGTH}
              value={textoEscrito}
              placeholder={t('estructura.buscar_placeholder')}
              aria-label={t('estructura.buscar_aria')}
              onChange={(event) => setQ(event.target.value.slice(0, SEARCH_MAX_LENGTH))}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && textoEscrito !== '') {
                  event.preventDefault();
                  setQ('');
                }
              }}
              className="h-9 pl-8 pr-9"
            />
            {textoEscrito !== '' && (
              <button
                type="button"
                aria-label={t('estructura.limpiar_busqueda')}
                title={t('estructura.limpiar_busqueda')}
                onClick={() => {
                  setQ('');
                  entradaBusqueda.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>

          <div aria-live="polite" className="min-h-5 space-y-0.5 text-sm">
            {buscando && busqueda && (
              <p className="text-[var(--color-text-secondary)]">
                {busqueda.total > 0
                  ? t('estructura.resultados', { count: busqueda.total })
                  : t('estructura.sin_resultados')}
              </p>
            )}
            {cargandoTemario && (
              <p className="text-xs text-[var(--color-text-muted)]">{t('estructura.buscando_temario')}</p>
            )}
            {errorTemario && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {t('errores.error_conexion')}
              </p>
            )}
          </div>
        </div>
      )}

      {cuerpo}
    </section>
  );
}
