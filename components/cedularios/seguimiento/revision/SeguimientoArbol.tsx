'use client';

/**
 * Tracking tree of the Revisor (role="tree").
 *
 * Inputs are already loaded flat lists (materias and progress) plus the result of the pure
 * filter and search. Expanding and collapsing is local state and never issues a request.
 * Aggregates are computed over the whole tree, so filters and search never change a percentage.
 *
 * With 100 visible rows or fewer every row is in the DOM. With more, rows are virtualized with
 * fixed-height rows and an overscan of 20. Independent from the phase 1 list.
 *
 * Keyboard (row focused): Space toggles the checkbox, Enter opens the detail, arrows move the
 * focus (roving tabindex), right and left expand and collapse.
 */

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
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { construirAgregados } from '@/lib/cedularios/seguimiento/agregados';
import { nodosVisibles } from '@/lib/cedularios/seguimiento/arbol';
import {
  ALTURA_FILA,
  OVERSCAN_FILAS,
  UMBRAL_VIRTUALIZACION_FILAS,
} from '@/lib/cedularios/seguimiento/constants';
import type { ResultadoFiltro } from '@/lib/cedularios/seguimiento/filtros';
import type { ProgresoFila, RolMateria } from '@/lib/cedularios/seguimiento/tipos';
import {
  siguienteFoco,
  type FilaNavegable,
  type TeclaArbol,
} from '@/lib/cedularios/seguimiento/tree-nav';
import { aplanarVisibles, type FilaVisible, type MateriaNodo } from '@/lib/cedularios/tree';
import { SeguimientoArbolFila } from './SeguimientoArbolFila';

const SIN_IDS: ReadonlySet<string> = new Set<string>();

export interface SeguimientoArbolProps {
  asignacionId: string;
  /** Flat list of the active materias of the cedulario. */
  flat: MateriaNodo[];
  /** Progress rows of the assignment (the archived ones are ignored). */
  progreso: ProgresoFila[];
  /** Role of every materia shown, from `clasificarMaterias`. */
  roles: Map<string, RolMateria>;
  /** Result of `aplicarFiltroYBusqueda`: ids to render, ancestors to expand and text matches. */
  filtro: ResultadoFiltro;
  /** Trimmed search text applied to the tree, used to highlight matches. */
  consulta: string;
  /** Edit mode. Read mode shows non-interactive checkboxes. */
  editable: boolean;
  /** The materia whose detail is open (`seg_materia`). */
  materiaSeleccionadaId: string | null;
  /** Opens the detail of an assigned materia. */
  onAbrirDetalle: (materiaId: string) => void;
  /** Toggles the coverage of a materia and its branch (parent / child cascade). Stable. */
  onAlternarCobertura: (materiaId: string) => void;
  className?: string;
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
  className?: string;
  ref?: Ref<ListaHandle>;
}

/** 100 visible rows or fewer: every row is in the DOM. */
function ListaPlana({ filas, etiqueta, renderFila, className, ref }: ListaProps) {
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
      className={cn(
        'overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
        className,
      )}
    >
      {filas.map((fila, indice) => (
        <Fragment key={fila.nodo.id}>{renderFila(fila, indice)}</Fragment>
      ))}
    </div>
  );
}

/** More than 100 visible rows: fixed-height rows and an overscan of 20. */
function ListaVirtual({ filas, etiqueta, renderFila, className, ref }: ListaProps) {
  const contenedor = useRef<HTMLDivElement>(null);

  // React Compiler skips memoizing this component, which is the intended behavior for TanStack Virtual.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedor.current,
    estimateSize: () => ALTURA_FILA,
    overscan: OVERSCAN_FILAS,
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
      className={cn(
        'max-h-[70vh] overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
        className,
      )}
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

export function SeguimientoArbol({ asignacionId, ...props }: SeguimientoArbolProps) {
  // `key` resets expansion and focus when another assignment is shown.
  return <SeguimientoArbolContenido key={asignacionId} asignacionId={asignacionId} {...props} />;
}

function SeguimientoArbolContenido({
  asignacionId,
  flat,
  progreso,
  roles,
  filtro,
  consulta,
  editable,
  materiaSeleccionadaId,
  onAbrirDetalle,
  onAlternarCobertura,
  className,
}: SeguimientoArbolProps) {
  const t = useTranslations('cedularios.seguimiento.revision');
  const tEstructura = useTranslations('cedularios.estructura');

  // Materias with a role, before the filter. Used to know which ones really have children.
  const conRol = useMemo(() => nodosVisibles(flat, roles), [flat, roles]);
  const padresConHijos = useMemo(() => {
    const ids = new Set<string>();
    for (const nodo of conRol) if (nodo.parentId !== null) ids.add(nodo.parentId);
    return ids;
  }, [conRol]);

  const nodos = useMemo(
    () => conRol.filter((nodo) => filtro.visibles.has(nodo.id)),
    [conRol, filtro.visibles],
  );

  // Aggregates over the whole tree: filter and search never change a percentage.
  const agregados = useMemo(() => construirAgregados(flat, progreso), [flat, progreso]);
  const progresoPorMateria = useMemo(() => {
    const mapa = new Map<string, ProgresoFila>();
    for (const fila of progreso) if (fila.asignada) mapa.set(fila.materiaId, fila);
    return mapa;
  }, [progreso]);

  // ── Expansion (local state, never a request) ──────────────────────────────
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(SIN_IDS);
  const [claveAplicada, setClaveAplicada] = useState('');
  const claveExpansion = useMemo(
    () => Array.from(filtro.expandir).sort().join(','),
    [filtro.expandir],
  );
  if (claveExpansion !== claveAplicada) {
    // Adjusting state while rendering: the rows below already use the new expansion.
    setClaveAplicada(claveExpansion);
    if (filtro.expandir.size === 0) {
      // Filter and search cleared: back to the default collapsed state.
      setExpandidos(SIN_IDS);
    } else {
      const ancestros = filtro.expandir;
      setExpandidos((previo) => new Set([...previo, ...ancestros]));
    }
  }

  const alternar = useCallback((id: string) => {
    setExpandidos((previo) => {
      const siguiente = new Set(previo);
      if (!siguiente.delete(id)) siguiente.add(id);
      return siguiente;
    });
  }, []);

  // Branches of the rows that can be shown (after role and filter): what "expand all" opens.
  const ramas = useMemo(() => {
    const ids = new Set(nodos.map((nodo) => nodo.id));
    const conHijos = new Set<string>();
    for (const nodo of nodos) {
      if (nodo.parentId !== null && ids.has(nodo.parentId)) conHijos.add(nodo.parentId);
    }
    return [...conHijos];
  }, [nodos]);
  const todoExpandido = ramas.length > 0 && ramas.every((id) => expandidos.has(id));
  const nadaExpandido = ramas.every((id) => !expandidos.has(id));
  const expandirTodo = useCallback(() => setExpandidos(new Set(ramas)), [ramas]);
  const contraerTodo = useCallback(() => setExpandidos(SIN_IDS), []);

  const filas = useMemo(() => aplanarVisibles(nodos, expandidos), [nodos, expandidos]);
  const navegables = useMemo<FilaNavegable[]>(
    () =>
      filas.map((fila) => ({
        id: fila.nodo.id,
        tieneHijos: fila.tieneHijos,
        expandido: fila.expandido,
        parentId: fila.nodo.parentId,
      })),
    [filas],
  );
  const navegablesRef = useRef(navegables);
  useEffect(() => {
    navegablesRef.current = navegables;
  }, [navegables]);

  // ── Focus (roving tabindex) and keyboard navigation ───────────────────────
  const [focoId, setFocoId] = useState<string | null>(null);
  const [enfocarId, setEnfocarId] = useState<string | null>(null);
  const listaRef = useRef<ListaHandle>(null);

  const idTabulable = useMemo(() => {
    if (focoId && filas.some((f) => f.nodo.id === focoId)) return focoId;
    if (materiaSeleccionadaId && filas.some((f) => f.nodo.id === materiaSeleccionadaId)) {
      return materiaSeleccionadaId;
    }
    return filas[0]?.nodo.id ?? null;
  }, [filas, focoId, materiaSeleccionadaId]);

  const enfocada = useCallback((id: string) => {
    setFocoId(id);
    setEnfocarId(null);
  }, []);

  const manejarTecla = useCallback(
    (indice: number, tecla: TeclaArbol) => {
      const visibles = navegablesRef.current;
      if (visibles.length === 0) return;
      const resultado = siguienteFoco(visibles, indice, tecla);
      if (resultado.accion === 'foco') {
        if (resultado.indice === indice) return;
        listaRef.current?.scrollAIndice(resultado.indice);
        setEnfocarId(visibles[resultado.indice].id);
        return;
      }
      // 'expandir' and 'contraer' toggle the row that has the focus.
      alternar(visibles[resultado.indice].id);
    },
    [alternar],
  );

  // ── Rendering ─────────────────────────────────────────────────────────────
  if (filas.length === 0) return null;

  const renderFila = (fila: FilaVisible, indice: number): ReactNode => {
    const id = fila.nodo.id;
    const rol = roles.get(id) ?? 'contexto';
    return (
      <SeguimientoArbolFila
        asignacionId={asignacionId}
        nodo={fila.nodo}
        indice={indice}
        profundidad={fila.profundidad}
        tieneHijos={fila.tieneHijos}
        expandido={fila.expandido}
        rol={rol}
        progreso={progresoPorMateria.get(id)}
        agregado={agregados.get(id)}
        mostrarPorcentajeRama={padresConHijos.has(id)}
        editable={editable}
        seleccionada={id === materiaSeleccionadaId}
        tabulable={id === idTabulable}
        enfocar={id === enfocarId}
        consulta={consulta}
        coincide={filtro.coincidencias.has(id)}
        onAbrirDetalle={onAbrirDetalle}
        onAlternar={alternar}
        onAlternarCobertura={onAlternarCobertura}
        onTecla={manejarTecla}
        onEnfocada={enfocada}
      />
    );
  };

  const etiqueta = t('arbol_aria');
  const lista =
    filas.length > UMBRAL_VIRTUALIZACION_FILAS ? (
      <ListaVirtual
        ref={listaRef}
        filas={filas}
        etiqueta={etiqueta}
        renderFila={renderFila}
        className={className}
      />
    ) : (
      <ListaPlana
        ref={listaRef}
        filas={filas}
        etiqueta={etiqueta}
        renderFila={renderFila}
        className={className}
      />
    );

  return (
    <div className="space-y-2">
      {/* Expand / collapse every level at once, between the search and the tree (same pattern as
          the cedulario structure tree). Only when there are branches. */}
      {ramas.length > 0 && (
        <div className="flex items-center gap-1" role="group" aria-label={etiqueta}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ChevronsUpDown className="size-4" aria-hidden="true" />}
            onClick={expandirTodo}
            disabled={todoExpandido}
          >
            {tEstructura('expandir_todo')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ChevronsDownUp className="size-4" aria-hidden="true" />}
            onClick={contraerTodo}
            disabled={nadaExpandido}
          >
            {tEstructura('contraer_todo')}
          </Button>
        </div>
      )}
      {lista}
    </div>
  );
}
