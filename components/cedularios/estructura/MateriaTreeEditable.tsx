'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, type SortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CEDULARIOS_I18N_NAMESPACE, type CedularioErrorCode } from '@/lib/cedularios/errors';
import { validarMovimiento, type FilaVisible, type MateriaNodo, type Movimiento } from '@/lib/cedularios/tree';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useMateriasTree } from '../hooks/useMaterias';
import { useMoverMateria } from '../hooks/useMoverMateria';
import { MateriaRowMenu } from './MateriaRowMenu';
import { MateriaTree, type MateriaTreeHandle, type MateriaTreeProps } from './MateriaTree';
import { MateriaTreeRow, SANGRIA_POR_NIVEL, type MateriaTreeRowProps } from './MateriaTreeRow';
import { codigoErrorMovimiento, idsOcultosAlArrastrar, type ProyeccionArrastre } from './movimientos';
import { useTreeDnd, type UseTreeDndOptions } from './useTreeDnd';

const SIN_MATERIAS: MateriaNodo[] = [];
const SIN_IDS: ReadonlySet<string> = new Set<string>();

/** Rows do not shift while dragging: the dragged row is shown in a `DragOverlay` and a line marks the drop. */
const sinDesplazamiento: SortingStrategy = () => null;

// ---------------------------------------------------------------------------
// Context shared by ArbolSortable and its rows
// ---------------------------------------------------------------------------

interface ContextoArbol {
  flat: MateriaNodo[];
  mover: (movimiento: Movimiento) => void;
  activoId: string | null;
  sobreId: string | null;
  proyeccion: ProyeccionArrastre | null;
  /** Descendants of the dragged materia: not drop targets while it is dragged. */
  ocultos: ReadonlySet<string>;
}

const ContextoArbolEditable = createContext<ContextoArbol | null>(null);

function useContextoArbol(): ContextoArbol {
  const contexto = useContext(ContextoArbolEditable);
  if (!contexto) throw new Error('MateriaTreeEditable row rendered outside of its tree');
  return contexto;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Line on the hovered row marking where the dragged materia would land (brand color, red if invalid). */
function estiloIndicador(proyeccion: ProyeccionArrastre): CSSProperties {
  const color = proyeccion.validacion.ok ? 'var(--color-brand-gold)' : 'var(--color-error)';
  const izquierda = 8 + proyeccion.profundidad * SANGRIA_POR_NIVEL;
  return {
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `calc(100% - ${izquierda}px) 2px`,
    backgroundPosition: `${izquierda}px ${proyeccion.borde === 'arriba' ? 'top' : 'bottom'}`,
  };
}

interface ExtensionesFila {
  renderContenido?: (fila: FilaVisible, propsFila: MateriaTreeRowProps) => ReactNode;
  accionesExtra?: (fila: FilaVisible) => ReactNode;
}

interface FilaProps extends ExtensionesFila {
  propsFila: MateriaTreeRowProps;
}

/** Row with drag handle and row menu. Must be a component of its own: it calls `useSortable`. */
function FilaSortable({ propsFila, renderContenido, accionesExtra }: FilaProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const { flat, mover, sobreId, proyeccion } = useContextoArbol();
  const { fila, tabulable } = propsFila;
  const { nodo } = fila;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: nodo.id });

  const proyectadaAqui = sobreId === nodo.id ? proyeccion : null;
  const indicador =
    proyectadaAqui && !(proyectadaAqui.validacion.ok && proyectadaAqui.sinCambio)
      ? estiloIndicador(proyectadaAqui)
      : undefined;

  const asa = (
    <button
      {...attributes}
      {...listeners}
      type="button"
      ref={setActivatorNodeRef}
      // Only the row with the roving tabindex puts its handle and menu in the tab order.
      tabIndex={tabulable ? 0 : -1}
      aria-label={t('estructura.arrastrar_aria', { nombre: nodo.nombre })}
      className={cn(
        'inline-flex size-7 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors',
        'hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
        isDragging && 'cursor-grabbing',
      )}
    >
      <GripVertical aria-hidden="true" className="size-4" />
    </button>
  );

  return (
    <MateriaTreeRow
      {...propsFila}
      inicio={asa}
      contenido={renderContenido?.(fila, propsFila)}
      acciones={
        <MateriaRowMenu
          flat={flat}
          materia={nodo}
          onMover={mover}
          tabulable={tabulable}
          extraItems={accionesExtra?.(fila)}
        />
      }
      rowRef={setNodeRef}
      style={{
        ...indicador,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(isDragging && 'opacity-40')}
    />
  );
}

/** Descendants of the dragged row stay in place, dimmed, and are not drop targets. */
function FilaMateria(props: FilaProps) {
  const { ocultos } = useContextoArbol();
  if (ocultos.has(props.propsFila.fila.nodo.id)) {
    return <MateriaTreeRow {...props.propsFila} className="pointer-events-none opacity-40" />;
  }
  return <FilaSortable {...props} />;
}

/** What follows the pointer while dragging (the real row stays in place, dimmed). */
function FilaFlotante({ fila, valida }: { fila: FilaVisible; valida: boolean }) {
  return (
    <div
      style={{ paddingLeft: 8 + fila.profundidad * SANGRIA_POR_NIVEL }}
      className={cn(
        'box-border flex h-10 w-full cursor-grabbing items-center gap-2 rounded-[var(--radius-md)] border-2 bg-[var(--color-bg)] pr-3 text-sm shadow-[var(--shadow-md)]',
        valida ? 'border-[var(--color-brand-gold)]' : 'border-[var(--color-error)]',
      )}
    >
      <GripVertical aria-hidden="true" className="size-4 shrink-0 text-[var(--color-text-muted)]" />
      <span className="shrink-0 font-semibold text-[var(--color-text-primary)]">{fila.nodo.codigo}</span>
      <span className="min-w-0 truncate text-[var(--color-text-primary)]">{fila.nodo.nombre}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag and drop wrapper (rendered through MateriaTree's `envolverLista`)
// ---------------------------------------------------------------------------

interface ArbolSortableProps {
  cedularioId: string;
  lista: ReactNode;
  filas: FilaVisible[];
  expandir: (id: string) => void;
  onArrastre: UseTreeDndOptions['onArrastre'];
}

function ArbolSortable({ cedularioId, lista, filas, expandir, onArrastre }: ArbolSortableProps) {
  const dndId = useId();
  const { data } = useMateriasTree(cedularioId);
  const flat = data ?? SIN_MATERIAS;
  const { showError } = useCedulariosAction();
  const { mutateAsync } = useMoverMateria(cedularioId);

  /**
   * Single entry point of every move (drag and menu). A move rejected by `validarMovimiento`
   * never reaches the server; otherwise the hook applies the optimistic update, restores the
   * snapshot on failure and shows the error toast.
   */
  const mover = useCallback(
    async (movimiento: Movimiento) => {
      const validacion = validarMovimiento(flat, movimiento.id, movimiento.nuevoParentId);
      if (!validacion.ok) {
        const code = codigoErrorMovimiento(validacion.razon);
        if (code) showError({ code });
        return;
      }
      // Reveal the moved materia when it goes into a collapsed parent.
      if (movimiento.nuevoParentId !== null) expandir(movimiento.nuevoParentId);
      try {
        await mutateAsync(movimiento);
      } catch {
        // The hook restored the cache and showed the error.
      }
    },
    [flat, expandir, mutateAsync, showError],
  );

  const mostrarError = useCallback((code: CedularioErrorCode) => showError({ code }), [showError]);

  const dnd = useTreeDnd({ flat, filas, mover, mostrarError, onArrastre });

  const ocultos = useMemo(
    () => (dnd.activoId !== null ? idsOcultosAlArrastrar(flat, dnd.activoId) : SIN_IDS),
    [flat, dnd.activoId],
  );
  const ids = useMemo(
    () => filas.filter((f) => !ocultos.has(f.nodo.id)).map((f) => f.nodo.id),
    [filas, ocultos],
  );
  const filaActiva = dnd.activoId !== null ? filas.find((f) => f.nodo.id === dnd.activoId) : undefined;

  const contexto = useMemo<ContextoArbol>(
    () => ({
      flat,
      mover: (movimiento) => void mover(movimiento),
      activoId: dnd.activoId,
      sobreId: dnd.sobreId,
      proyeccion: dnd.proyeccion,
      ocultos,
    }),
    [flat, mover, dnd.activoId, dnd.sobreId, dnd.proyeccion, ocultos],
  );

  return (
    <ContextoArbolEditable.Provider value={contexto}>
      <DndContext id={dndId} collisionDetection={closestCenter} {...dnd.dndProps}>
        <SortableContext items={ids} strategy={sinDesplazamiento}>
          {lista}
        </SortableContext>
        {typeof document === 'undefined'
          ? null
          : createPortal(
              <DragOverlay dropAnimation={null}>
                {filaActiva ? (
                  <FilaFlotante fila={filaActiva} valida={dnd.proyeccion?.validacion.ok ?? true} />
                ) : null}
              </DragOverlay>,
              document.body,
            )}
      </DndContext>
    </ContextoArbolEditable.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface MateriaTreeEditableProps
  extends Omit<MateriaTreeProps, 'puedeEditar' | 'indiceSiempreMontado' | 'renderFila' | 'envolverLista' | 'ref'> {
  /**
   * Extension point for inline edit (task 10.8): replaces the código + nombre of a row. Receives
   * the row and the props the base row would get. Clicks inside still reach the row: stop them.
   */
  renderContenido?: (fila: FilaVisible, propsFila: MateriaTreeRowProps) => ReactNode;
  /**
   * Extension point for the row menu (task 10.8: Edit, Add child, Delete): extra entries shown
   * below Move up / Move down / Indent / Outdent. Return `DropdownMenuItem`s.
   */
  accionesExtra?: (fila: FilaVisible) => ReactNode;
  ref?: Ref<MateriaTreeHandle>;
}

/**
 * Materia tree for users who can edit: `MateriaTree` plus drag and drop and the row menu
 * (Requirements 4.4, 4.10, 4.11, 4.14, 12.3 to 12.7, 12.13, 15.6, 16.1, 16.3, 16.11).
 *
 * - Drag the grip handle of a row (mouse, touch after a 250 ms hold, or keyboard: Space to pick
 *   up, arrows to move, Left/Right to change level, Space to drop, Escape to cancel). The
 *   hovered row and the horizontal offset select reorder, indent or outdent, as in the dnd-kit
 *   sortable-tree example. Valid drops are marked with a brand-color line, invalid ones (own
 *   descendant, depth over 5, duplicated código) with a red line and are not applied.
 * - The row menu (Move up, Move down, Indent, Outdent) is the keyboard and touch alternative.
 * - Both call `useMoverMateria`, which updates the cache optimistically and rolls back on error.
 * - With virtualization the dragged row stays mounted (`indiceSiempreMontado`).
 *
 * The `ref` exposes the same `MateriaTreeHandle` as `MateriaTree`.
 */
export function MateriaTreeEditable({ renderContenido, accionesExtra, ref, ...props }: MateriaTreeEditableProps) {
  const arbolRef = useRef<MateriaTreeHandle>(null);
  const [arrastre, setArrastre] = useState<{ id: string; indice: number } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      expandir: (id) => arbolRef.current?.expandir(id),
      expandirTodo: (id) => arbolRef.current?.expandirTodo(id),
      contraerTodo: (id) => arbolRef.current?.contraerTodo(id),
      subarbolExpandido: (id) => arbolRef.current?.subarbolExpandido(id) ?? false,
      scrollAMateria: (id) => arbolRef.current?.scrollAMateria(id),
    }),
    [],
  );

  const expandir = useCallback((id: string) => arbolRef.current?.expandir(id), []);

  return (
    <MateriaTree
      {...props}
      ref={arbolRef}
      puedeEditar
      indiceSiempreMontado={arrastre?.indice ?? null}
      renderFila={(propsFila) => (
        <FilaMateria propsFila={propsFila} renderContenido={renderContenido} accionesExtra={accionesExtra} />
      )}
      envolverLista={(lista, filas) => (
        <ArbolSortable
          cedularioId={props.cedularioId}
          lista={lista}
          filas={filas}
          expandir={expandir}
          onArrastre={setArrastre}
        />
      )}
    />
  );
}
