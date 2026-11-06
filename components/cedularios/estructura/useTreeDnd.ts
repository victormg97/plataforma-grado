'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DndContextProps,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CEDULARIOS_I18N_NAMESPACE, type CedularioErrorCode } from '@/lib/cedularios/errors';
import type { FilaVisible, MateriaNodo, Movimiento } from '@/lib/cedularios/tree';
import { SANGRIA_POR_NIVEL } from './MateriaTreeRow';
import { codigoErrorMovimiento, proyectarArrastre, type ProyeccionArrastre } from './movimientos';

/** Pixels of pointer travel before a mouse drag starts (clicks on the handle stay clicks). */
const DISTANCIA_ACTIVACION_PX = 4;

/** Press-and-hold time before a touch drag starts, so scrolling the list still works. */
const RETARDO_TOUCH_MS = 250;

/**
 * Keyboard drag: Up/Down move between rows (sortable coordinates, keeping the horizontal
 * offset), Left/Right change the level by one indentation step.
 */
const coordenadasTeclado: KeyboardCoordinateGetter = (event, args) => {
  const { currentCoordinates } = args;
  if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') {
    event.preventDefault();
    const paso = event.code === 'ArrowRight' ? SANGRIA_POR_NIVEL : -SANGRIA_POR_NIVEL;
    return { x: currentCoordinates.x + paso, y: currentCoordinates.y };
  }
  const coordenadas = sortableKeyboardCoordinates(event, args);
  return coordenadas ? { x: currentCoordinates.x, y: coordenadas.y } : coordenadas;
};

export interface UseTreeDndOptions {
  flat: MateriaNodo[];
  /** Visible rows of the tree, in order. */
  filas: FilaVisible[];
  /** Requests a valid move (optimistic update, rollback and server errors live in the caller). */
  mover: (movimiento: Movimiento) => void | Promise<void>;
  /** Shows the error toast of a move rejected locally. */
  mostrarError: (code: CedularioErrorCode) => void;
  /** The dragged row changed: `indice` is its index among the visible rows; `null` when it ended. */
  onArrastre: (activo: { id: string; indice: number } | null) => void;
}

export interface UseTreeDnd {
  /** Spread on `<DndContext>`. */
  dndProps: Pick<
    DndContextProps,
    | 'sensors'
    | 'accessibility'
    | 'onDragStart'
    | 'onDragMove'
    | 'onDragOver'
    | 'onDragEnd'
    | 'onDragCancel'
  >;
  activoId: string | null;
  sobreId: string | null;
  /** Projection of the current drag; `null` when nothing is dragged or no target is hovered. */
  proyeccion: ProyeccionArrastre | null;
}

/**
 * Drag and drop of the materia tree (Requirements 4.10, 12.3 to 12.7, 12.13).
 *
 * Sensors: mouse (distance), touch (250 ms delay) and keyboard. The horizontal offset of the drag
 * (in indentation steps) and the hovered row give the projected parent and position; the
 * projection is validated with `validarMovimiento`. Dropping on an invalid projection requests
 * nothing and shows the translated error; dropping on a valid one calls `mover`.
 */
export function useTreeDnd({ flat, filas, mover, mostrarError, onArrastre }: UseTreeDndOptions): UseTreeDnd {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const [activoId, setActivoId] = useState<string | null>(null);
  const [sobreId, setSobreId] = useState<string | null>(null);
  const [niveles, setNiveles] = useState(0);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: DISTANCIA_ACTIVACION_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: RETARDO_TOUCH_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasTeclado }),
  );

  const proyeccion = useMemo(
    () =>
      activoId !== null && sobreId !== null
        ? proyectarArrastre({ flat, filas, activoId, sobreId, niveles })
        : null,
    [flat, filas, activoId, sobreId, niveles],
  );

  const reiniciar = () => {
    setActivoId(null);
    setSobreId(null);
    setNiveles(0);
    onArrastre(null);
  };

  const nombreDe = (id: string | number): string => flat.find((n) => n.id === String(id))?.nombre ?? '';

  const alIniciar = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    setActivoId(id);
    setSobreId(id);
    setNiveles(0);
    onArrastre({ id, indice: filas.findIndex((f) => f.nodo.id === id) });
  };

  const alMover = ({ delta }: DragMoveEvent) => {
    const siguiente = Math.round(delta.x / SANGRIA_POR_NIVEL);
    setNiveles((previo) => (previo === siguiente ? previo : siguiente));
  };

  const alPasarSobre = ({ over }: DragOverEvent) => {
    setSobreId(over ? String(over.id) : null);
  };

  const alSoltar = ({ active, over, delta }: DragEndEvent) => {
    reiniciar();
    if (!over) return;
    const proyectada = proyectarArrastre({
      flat,
      filas,
      activoId: String(active.id),
      sobreId: String(over.id),
      niveles: Math.round(delta.x / SANGRIA_POR_NIVEL),
    });
    if (!proyectada) return;
    if (!proyectada.validacion.ok) {
      // Not a valid drop zone: nothing is requested and the tree stays as it was.
      const code = codigoErrorMovimiento(proyectada.validacion.razon);
      if (code) mostrarError(code);
      return;
    }
    if (proyectada.sinCambio) return;
    void mover(proyectada.movimiento);
  };

  const accessibility: Announcements = {
    onDragStart: ({ active }) => t('estructura.arrastre_inicio', { nombre: nombreDe(active.id) }),
    onDragOver: ({ active, over }) => {
      if (!over) return undefined;
      const valores = { nombre: nombreDe(active.id), destino: nombreDe(over.id) };
      const invalida = proyeccion !== null && !proyeccion.validacion.ok;
      return t(invalida ? 'estructura.arrastre_invalido' : 'estructura.arrastre_sobre', valores);
    },
    onDragEnd: ({ active, over }) => {
      const nombre = nombreDe(active.id);
      if (!over) return t('estructura.arrastre_cancelado', { nombre });
      const destino = nombreDe(over.id);
      // An invalid drop is not applied.
      const invalida = proyeccion !== null && !proyeccion.validacion.ok;
      return t(invalida ? 'estructura.arrastre_invalido' : 'estructura.arrastre_fin', { nombre, destino });
    },
    onDragCancel: ({ active }: DragCancelEvent) =>
      t('estructura.arrastre_cancelado', { nombre: nombreDe(active.id) }),
  };

  return {
    dndProps: {
      sensors: sensores,
      accessibility: {
        announcements: accessibility,
        screenReaderInstructions: { draggable: t('estructura.arrastre_instrucciones') },
      },
      onDragStart: alIniciar,
      onDragMove: alMover,
      onDragOver: alPasarSobre,
      onDragEnd: alSoltar,
      onDragCancel: reiniciar,
    },
    activoId,
    sobreId,
    proyeccion,
  };
}
