'use client';

/**
 * Coverage checkbox of a materia in the Revisor.
 * Edit mode: an accessible toggle button (role="checkbox"). Read mode: a
 * non-interactive indicator with the same role and state, no handlers.
 * The tree owns keyboard focus (roving tabindex), so by default the control is not a tab
 * stop. Outside the tree (detail panel) pass `focusable` to make it reachable with Tab.
 */

import type { MouseEvent } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ProgresoCheckProps {
  /** Whether the materia is covered. */
  cubierta: boolean;
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

export function ProgresoCheck({
  cubierta,
  materia,
  editable,
  onToggle,
  focusable = false,
  className,
}: ProgresoCheckProps) {
  const t = useTranslations('cedularios.seguimiento.revision.fila');

  const estadoClass = cubierta
    ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
    : 'border-[var(--color-border)] bg-[var(--color-bg)] text-transparent';

  if (!editable) {
    return (
      <span
        role="checkbox"
        aria-checked={cubierta}
        aria-readonly="true"
        aria-label={`${materia}: ${cubierta ? t('cubierta') : t('pendiente')}`}
        className={cn(BASE_CLASS, estadoClass, className)}
      >
        <Check className="size-3.5" aria-hidden="true" />
      </span>
    );
  }

  const manejarClick = (e: MouseEvent<HTMLButtonElement>) => {
    // The row opens the detail on click; the checkbox must not trigger that.
    e.stopPropagation();
    onToggle?.();
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={cubierta}
      aria-label={
        cubierta ? t('marcar_pendiente', { materia }) : t('marcar_cubierta', { materia })
      }
      tabIndex={focusable ? 0 : -1}
      onClick={manejarClick}
      className={cn(
        BASE_CLASS,
        estadoClass,
        'cursor-pointer hover:border-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
        className,
      )}
    >
      <Check className="size-3.5" aria-hidden="true" />
    </button>
  );
}
