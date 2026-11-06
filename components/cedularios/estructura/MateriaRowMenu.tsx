'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowLeftToLine, ArrowRightToLine, ArrowUp, EllipsisVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import type { MateriaNodo, Movimiento } from '@/lib/cedularios/tree';
import { movimientosDisponibles } from './movimientos';

export interface MateriaRowMenuProps {
  /** Flat structure of the cedulario (to know which moves are possible). */
  flat: MateriaNodo[];
  materia: MateriaNodo;
  /** Called with the move of the chosen action (Move up, Move down, Indent, Outdent). */
  onMover: (movimiento: Movimiento) => void;
  /**
   * Extra menu entries rendered after the move actions, separated by a divider (task 10.8:
   * Edit, Add child, Delete). Use `DropdownMenuItem` from `@/components/ui/dropdown-menu`.
   */
  extraItems?: ReactNode;
  /** Whether the trigger is in the tab order (the row with the roving tabindex). Default true. */
  tabulable?: boolean;
}

interface ItemsMovimientoProps {
  flat: MateriaNodo[];
  id: string;
  onMover: (movimiento: Movimiento) => void;
}

/** Move entries. Mounted only while the menu is open, so the availability is computed on demand. */
function ItemsMovimiento({ flat, id, onMover }: ItemsMovimientoProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const disponibles = useMemo(() => movimientosDisponibles(flat, id), [flat, id]);

  const entradas = [
    { accion: 'subir', movimiento: disponibles.subir, etiqueta: t('estructura.mover_arriba'), icono: ArrowUp },
    { accion: 'bajar', movimiento: disponibles.bajar, etiqueta: t('estructura.mover_abajo'), icono: ArrowDown },
    {
      accion: 'indentar',
      movimiento: disponibles.indentar,
      etiqueta: t('estructura.indentar'),
      icono: ArrowRightToLine,
    },
    {
      accion: 'desindentar',
      movimiento: disponibles.desindentar,
      etiqueta: t('estructura.desindentar'),
      icono: ArrowLeftToLine,
    },
  ] as const;

  return (
    <>
      {entradas.map(({ accion, movimiento, etiqueta, icono: Icono }) => (
        <DropdownMenuItem
          key={accion}
          data-accion={accion}
          disabled={movimiento === null}
          onClick={() => {
            if (movimiento) onMover(movimiento);
          }}
        >
          <Icono aria-hidden="true" />
          {etiqueta}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/**
 * Row menu of a materia: the non-drag alternative to drag and drop (Requirement 12.6).
 *
 * Move up, Move down, Indent and Outdent call `onMover` with the move to request; the ones that
 * are not possible (first or last sibling, no previous sibling, root, depth over MAX_NIVEL,
 * duplicated código) are disabled. Keyboard: the trigger opens with Enter, Space or ArrowDown, the
 * items are reached with the arrow keys and Escape closes it. `extraItems` adds entries below.
 */
export function MateriaRowMenu({ flat, materia, onMover, extraItems, tabulable = true }: MateriaRowMenuProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('estructura.menu_aria', { nombre: materia.nombre })}
        tabIndex={tabulable ? 0 : -1}
        className={cn(
          'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors',
          'hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
          'data-popup-open:bg-[var(--color-bg-elevated)]',
        )}
      >
        <EllipsisVertical aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        <ItemsMovimiento flat={flat} id={materia.id} onMover={onMover} />
        {extraItems ? (
          <>
            <DropdownMenuSeparator />
            {extraItems}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
