'use client';

import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/common/Tooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EstadoCell = 'pagado' | 'parcial' | null;

export interface CellButtonProps {
  estado: EstadoCell;
  monto: number | null;
  mesLabel: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CellButton({ estado, monto, mesLabel, onClick, buttonRef, isOpen }: CellButtonProps) {
  const isPaid = estado === 'pagado';
  const isPartial = estado === 'parcial';

  const title = isPaid
    ? `${mesLabel}: Pagado${monto ? ` · $${monto.toLocaleString('es-CL')}` : ''}`
    : isPartial
    ? `${mesLabel}: Parcial${monto ? ` · $${monto.toLocaleString('es-CL')}` : ''}`
    : `${mesLabel}: Sin pago`;

  return (
    <Tooltip content={title} position="top">
      <button
        ref={buttonRef as React.RefObject<HTMLButtonElement>}
        onClick={onClick}
        aria-label={title}
        aria-expanded={isOpen}
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-[11px] font-bold',
          'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
          'hover:scale-110 active:scale-95',
          isPaid && 'bg-[var(--color-success)] text-white shadow-sm',
          isPartial && 'bg-[var(--color-partial)] text-white shadow-sm',
          !estado && cn(
            'border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-transparent',
            'hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)] hover:text-[var(--color-brand-gold)]'
          ),
          isOpen && 'ring-2 ring-[var(--color-brand-gold)] ring-offset-1'
        )}
      >
        {isPaid ? '✓' : isPartial ? '½' : '+'}
      </button>
    </Tooltip>
  );
}
