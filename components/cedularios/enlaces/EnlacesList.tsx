'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, ExternalLink, GripVertical, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { cn } from '@/lib/utils';
import type { EnlaceScope } from '@/lib/cedularios/keys';
import type { Enlace } from '@/lib/queries/cedularios/enlaces';
import { useEliminarEnlace, useEnlaces, useReordenarEnlaces } from '../hooks/useEnlaces';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { EnlaceForm } from './EnlaceForm';

export interface EnlacesListProps {
  scope: EnlaceScope;
  /** Cedulario id (scope `cedulario`) or materia id (scope `materia`). */
  parentId: string;
  /** Shows the add, edit, delete and reorder controls. Read-only users only see the hyperlinks. */
  puedeEditar: boolean;
}

type Direccion = 'subir' | 'bajar';

/** Only http and https urls are rendered as hyperlinks (the stored value is validated too). */
function esUrlHttp(url: string): boolean {
  try {
    const protocolo = new URL(url).protocol;
    return protocolo === 'http:' || protocolo === 'https:';
  } catch {
    return false;
  }
}

function BotonIcono({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors',
        'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
        'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function EnlaceContenido({ enlace }: { enlace: Enlace }) {
  const t = useTranslations('cedularios');
  return (
    <div className="min-w-0 flex-1">
      {esUrlHttp(enlace.url) ? (
        <a
          href={enlace.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-[var(--color-brand-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
        >
          <span className="break-words">{enlace.titulo}</span>
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t('comun.abre_nueva_pestana')}</span>
        </a>
      ) : (
        <span className="break-words text-sm font-medium text-[var(--color-text-primary)]">
          {enlace.titulo}
        </span>
      )}
      {enlace.descripcion && (
        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-[var(--color-text-secondary)]">
          {enlace.descripcion}
        </p>
      )}
    </div>
  );
}

const CLASE_FILA =
  'flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3';

interface FilaEditableProps {
  enlace: Enlace;
  indice: number;
  total: number;
  bloqueado: boolean;
  onMover: (id: string, direccion: Direccion) => void;
  onEditar: (enlace: Enlace) => void;
  onEliminar: (enlace: Enlace) => void;
}

function FilaEditable({
  enlace,
  indice,
  total,
  bloqueado,
  onMover,
  onEditar,
  onEliminar,
}: FilaEditableProps) {
  const t = useTranslations('cedularios');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: enlace.id, disabled: bloqueado });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(CLASE_FILA, isDragging && 'relative z-10 shadow-[var(--shadow-md)]')}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        disabled={bloqueado}
        aria-label={t('enlaces.arrastrar_aria', { titulo: enlace.titulo })}
        className={cn(
          'inline-flex size-9 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors',
          'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          isDragging && 'cursor-grabbing',
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <EnlaceContenido enlace={enlace} />

      <div className="flex shrink-0 items-center">
        <BotonIcono
          data-enlace-id={enlace.id}
          data-accion="subir"
          disabled={bloqueado || indice === 0}
          aria-label={t('enlaces.mover_arriba_aria', { titulo: enlace.titulo })}
          title={t('enlaces.mover_arriba')}
          onClick={() => onMover(enlace.id, 'subir')}
        >
          <ArrowUp aria-hidden="true" />
        </BotonIcono>
        <BotonIcono
          data-enlace-id={enlace.id}
          data-accion="bajar"
          disabled={bloqueado || indice === total - 1}
          aria-label={t('enlaces.mover_abajo_aria', { titulo: enlace.titulo })}
          title={t('enlaces.mover_abajo')}
          onClick={() => onMover(enlace.id, 'bajar')}
        >
          <ArrowDown aria-hidden="true" />
        </BotonIcono>
        <BotonIcono
          aria-label={t('enlaces.editar_aria', { titulo: enlace.titulo })}
          title={t('enlaces.editar')}
          onClick={() => onEditar(enlace)}
        >
          <Pencil aria-hidden="true" />
        </BotonIcono>
        <BotonIcono
          className="hover:text-[var(--color-error)]"
          aria-label={t('enlaces.eliminar_aria', { titulo: enlace.titulo })}
          title={t('enlaces.eliminar')}
          onClick={() => onEliminar(enlace)}
        >
          <Trash2 aria-hidden="true" />
        </BotonIcono>
      </div>
    </li>
  );
}

/**
 * Enlaces of a cedulario or of a materia, ordered by `orden`. Users who can edit also get add,
 * edit, delete and reorder controls (drag and drop, plus move up/down buttons).
 */
export function EnlacesList({ scope, parentId, puedeEditar }: EnlacesListProps) {
  const t = useTranslations('cedularios');
  const dndId = useId();
  const { data, isPending, isError, refetch } = useEnlaces(scope, parentId);
  const reordenar = useReordenarEnlaces(scope, parentId);
  const eliminar = useEliminarEnlace();
  const { translateError } = useCedulariosAction();

  const [formulario, setFormulario] = useState<{ abierto: boolean; enlace: Enlace | null }>({
    abierto: false,
    enlace: null,
  });
  const [porEliminar, setPorEliminar] = useState<Enlace | null>(null);
  // Order shown while a reorder request is in flight (avoids a flash of the old order after a drop).
  const [idsPendientes, setIdsPendientes] = useState<string[] | null>(null);
  const focoPendiente = useRef<{ id: string; accion: Direccion } | null>(null);

  const lista = useMemo<Enlace[]>(() => {
    const base = data ?? [];
    if (!idsPendientes) return base;
    const porId = new Map(base.map((enlace) => [enlace.id, enlace]));
    const enPendientes = new Set(idsPendientes);
    const ordenados = idsPendientes.flatMap((id) => {
      const enlace = porId.get(id);
      return enlace ? [enlace] : [];
    });
    return [...ordenados, ...base.filter((enlace) => !enPendientes.has(enlace.id))];
  }, [data, idsPendientes]);

  const ids = useMemo(() => lista.map((enlace) => enlace.id), [lista]);
  const bloqueado = reordenar.isPending || idsPendientes !== null;

  // Keep keyboard focus on the moved row's button after it changes position.
  useEffect(() => {
    const pendiente = focoPendiente.current;
    if (!pendiente) return;
    focoPendiente.current = null;
    const selector = (accion: Direccion) =>
      `[data-enlace-id="${escaparAtributo(pendiente.id)}"][data-accion="${accion}"]`;
    const principal = document.querySelector<HTMLButtonElement>(selector(pendiente.accion));
    const alternativo = document.querySelector<HTMLButtonElement>(
      selector(pendiente.accion === 'subir' ? 'bajar' : 'subir'),
    );
    const destino = principal && !principal.disabled ? principal : alternativo;
    destino?.focus();
  }, [lista]);

  const persistirOrden = useCallback(
    async (nuevosIds: string[]) => {
      setIdsPendientes(nuevosIds);
      try {
        await reordenar.mutateAsync(nuevosIds);
      } catch {
        // The hook already restored the cache and showed the error.
      } finally {
        setIdsPendientes(null);
      }
    },
    [reordenar],
  );

  const mover = useCallback(
    (id: string, direccion: Direccion) => {
      if (bloqueado) return;
      const desde = ids.indexOf(id);
      const hasta = direccion === 'subir' ? desde - 1 : desde + 1;
      if (desde < 0 || hasta < 0 || hasta >= ids.length) return;
      focoPendiente.current = { id, accion: direccion };
      void persistirOrden(arrayMove(ids, desde, hasta));
    },
    [bloqueado, ids, persistirOrden],
  );

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const alSoltar = useCallback(
    (evento: DragEndEvent) => {
      const { active, over } = evento;
      if (!over || active.id === over.id || bloqueado) return;
      const desde = ids.indexOf(String(active.id));
      const hasta = ids.indexOf(String(over.id));
      if (desde < 0 || hasta < 0) return;
      void persistirOrden(arrayMove(ids, desde, hasta));
    },
    [bloqueado, ids, persistirOrden],
  );

  const anuncios = useMemo<Announcements>(() => {
    const tituloDe = (id: string | number) =>
      lista.find((enlace) => enlace.id === String(id))?.titulo ?? '';
    const posicion = (id: string | number) => ids.indexOf(String(id)) + 1;
    return {
      onDragStart: ({ active }) => t('enlaces.arrastre_inicio', { titulo: tituloDe(active.id) }),
      onDragOver: ({ active, over }) =>
        over
          ? t('enlaces.arrastre_sobre', {
              titulo: tituloDe(active.id),
              posicion: posicion(over.id),
              total: ids.length,
            })
          : undefined,
      onDragEnd: ({ active, over }) =>
        t('enlaces.arrastre_fin', {
          titulo: tituloDe(active.id),
          posicion: posicion(over ? over.id : active.id),
          total: ids.length,
        }),
      onDragCancel: ({ active }) =>
        t('enlaces.arrastre_cancelado', { titulo: tituloDe(active.id) }),
    };
  }, [ids, lista, t]);

  const confirmarEliminacion = async () => {
    if (!porEliminar) return;
    const resultado = await eliminar.mutateAsync({ scope, id: porEliminar.id });
    if (resultado.ok) setPorEliminar(null);
  };

  const titulo = scope === 'cedulario' ? t('enlaces.titulo_cedulario') : t('enlaces.titulo_materia');

  let cuerpo: ReactNode;
  if (isPending) {
    cuerpo = (
      <div role="status" aria-live="polite" className="space-y-2">
        <span className="sr-only">{t('enlaces.cargando')}</span>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]"
          />
        ))}
      </div>
    );
  } else if (isError && !data) {
    cuerpo = (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-6 text-center"
      >
        <p className="text-sm text-[var(--color-error)]">
          {translateError({ code: 'error_conexion' })}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          {t('comun.reintentar')}
        </Button>
      </div>
    );
  } else if (lista.length === 0) {
    cuerpo = (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-8 text-center">
        <Link2 className="size-8 text-[var(--color-text-muted)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('enlaces.vacio')}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {puedeEditar ? t('enlaces.vacio_descripcion') : t('enlaces.vacio_lector')}
        </p>
      </div>
    );
  } else if (puedeEditar) {
    cuerpo = (
      <DndContext
        id={dndId}
        sensors={sensores}
        collisionDetection={closestCenter}
        onDragEnd={alSoltar}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: { draggable: t('enlaces.arrastre_instrucciones') },
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={bloqueado}>
          <ul aria-label={titulo} aria-busy={bloqueado} className="space-y-2">
            {lista.map((enlace, indice) => (
              <FilaEditable
                key={enlace.id}
                enlace={enlace}
                indice={indice}
                total={lista.length}
                bloqueado={bloqueado}
                onMover={mover}
                onEditar={(e) => setFormulario({ abierto: true, enlace: e })}
                onEliminar={setPorEliminar}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    );
  } else {
    cuerpo = (
      <ul aria-label={titulo} className="space-y-2">
        {lista.map((enlace) => (
          <li key={enlace.id} className={CLASE_FILA}>
            <EnlaceContenido enlace={enlace} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-label={titulo} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{titulo}</h3>
        {puedeEditar && (
          <Button
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setFormulario({ abierto: true, enlace: null })}
          >
            {t('enlaces.agregar')}
          </Button>
        )}
      </div>

      {cuerpo}

      {puedeEditar && (
        <>
          <EnlaceForm
            open={formulario.abierto}
            onClose={() => setFormulario((anterior) => ({ ...anterior, abierto: false }))}
            scope={scope}
            parentId={parentId}
            enlace={formulario.enlace}
          />
          <ConfirmModal
            open={porEliminar !== null}
            onClose={() => setPorEliminar(null)}
            onConfirm={() => void confirmarEliminacion()}
            title={t('dialogos.eliminar_enlace.titulo')}
            description={t('dialogos.eliminar_enlace.descripcion', {
              titulo: porEliminar?.titulo ?? '',
            })}
            confirmText={t('dialogos.eliminar_enlace.confirmar')}
            cancelText={t('comun.cancelar')}
            loading={eliminar.isPending}
          />
        </>
      )}
    </section>
  );
}

/** Escapes a value for use inside a double-quoted attribute selector. */
function escaparAtributo(valor: string): string {
  return valor.replace(/["\\]/g, '\\$&');
}
