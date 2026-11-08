'use client';

import { CheckCircle2, Clock, UserX, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface AsistenciaEstadoSwitcherProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}

const ICONS: Record<string, LucideIcon> = {
  pendiente: Clock,
  confirmado: CheckCircle2,
  cancelado: XCircle,
  no_asistio: UserX,
};

const ACTIVE_TONE: Record<string, string> = {
  pendiente: 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]',
  confirmado: 'border-[color-mix(in_srgb,var(--color-success)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success-fg)]',
  cancelado: 'border-[color-mix(in_srgb,var(--color-error)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-error)_14%,transparent)] text-[var(--color-error-fg)]',
  no_asistio: 'border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]',
};

/** Segmented control to change a student's attendance status (profesor/admin). */
export function AsistenciaEstadoSwitcher({ value, options, onChange, disabled, ariaLabel }: AsistenciaEstadoSwitcherProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((opt) => {
        const Icon = ICONS[opt.value] ?? Clock;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-fg)]',
              active
                ? ACTIVE_TONE[opt.value] ?? ACTIVE_TONE.pendiente
                : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
