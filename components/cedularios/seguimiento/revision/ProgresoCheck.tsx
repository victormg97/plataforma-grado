'use client';

/**
 * Coverage checkbox of a materia in the Revisor.
 * Edit mode: an accessible toggle button (role="checkbox"). Read mode: a
 * non-interactive indicator with the same role and state, no handlers.
 * A branch shows the state of all its assigned materias: checked, unchecked or mixed
 * (`aria-checked="mixed"`, minus icon) when only some of them are covered.
 * The tree owns keyboard focus (roving tabindex), so by default the control is not a tab
 * stop. Outside the tree (detail panel) pass `focusable` to make it reachable with Tab.
 */

import type { MouseEvent } from 'react';
import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { EstadoVisual } from '@/lib/cedularios/seguimiento/cascada';

interface ProgresoCheckProps {
  /** Covered state of the materia, or of its whole branch (see `estadoVisual`). */
  estado: EstadoVisual;
  /** True when the checkbox acts on the materia and its descendants (labels say so). */
  rama?: boolean;
  /** Display name of the materia, used in the accessible label. */
  materia: string;
  /** True in edit mode; false renders a read-only indicator. */
  editable: boolean;
  /** Called when the user toggles the checkbox. Only used in edit mode. */
  onToggle?: () => void;
  /** Makes the control a tab stop. Default false (the tree manages focus). */
  focusable?: boolean;
  className?: string;
}

const BASE_CLASS =
  'inline-flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border transition-colors';

/** `aria-checked` value of a coverage state. */
export function ariaCheckedDe(estado: EstadoVisual): boolean | 'mixed' {
  return estado === 'todas' ? true : estado === 'algunas' ? 'mixed' : false;
}

export function ProgresoCheck({
  estado,
  rama = false,
  materia,
  editable,
  onToggle,
  focusable = false,
  className,
}: ProgresoCheckProps) {
  const t = useTranslations('cedularios.seguimiento.revision.fila');

  const estadoClass =
    estado === 'todas'
      ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
      : estado === 'algunas'
        ? 'border-[var(--color-success)] bg-[var(--color-bg)] text-[var(--color-success)]'
        : 'border-[var(--color-border)] bg-[var(--color-bg)] text-transparent';
  const Icono = estado === 'algunas' ? Minus : Check;
  const ariaChecked = ariaCheckedDe(estado);

  if (!editable) {
    const textoEstado =
      estado === 'todas' ? t('cubierta') : estado === 'algunas' ? t('parcial') : t('pendiente');
    return (
      <span
        role="checkbox"
        aria-checked={ariaChecked}
        aria-readonly="true"
        aria-label={`${materia}: ${textoEstado}`}
        className={cn(BASE_CLASS, estadoClass, className)}
      >
        <Icono className="size-3.5" aria-hidden="true" />
      </span>
    );
  }

  const manejarClick = (e: MouseEvent<HTMLButtonElement>) => {
    // The row opens the detail on click; the checkbox must not trigger that.
    e.stopPropagation();
    onToggle?.();
  };

  const desmarca = estado === 'todas';
  const etiqueta = rama
    ? t(desmarca ? 'desmarcar_rama' : 'marcar_rama', { materia })
    : t(desmarca ? 'marcar_pendiente' : 'marcar_cubierta', { materia });

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaChecked}
      aria-label={etiqueta}
      tabIndex={focusable ? 0 : -1}
      onClick={manejarClick}
      className={cn(
        BASE_CLASS,
        estadoClass,
        'cursor-pointer hover:border-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
        className,
      )}
    >
      <Icono className="size-3.5" aria-hidden="true" />
    </button>
  );
}
