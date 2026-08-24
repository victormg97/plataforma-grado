'use client';

/**
 * Selector de alcance para actividades de agenda.
 *
 * Dos botones/tabs para `alumnos_seleccionados` y `todos_alumnos`, con
 * iconos e i18n desde `agendaNucleo.alcance.*`.
 *
 * Requisitos: 4.1, 4.3, 15.1, 15.2
 */
import { Users, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { AgendaAlcance } from '@/lib/supabase/types';

type AlcanceActividad = Extract<AgendaAlcance, 'alumnos_seleccionados' | 'todos_alumnos'>;

export interface SelectorAlcanceProps {
  value: AlcanceActividad;
  onChange: (value: AlcanceActividad) => void;
  disabled?: boolean;
}

export function SelectorAlcance({
  value,
  onChange,
  disabled = false,
}: SelectorAlcanceProps) {
  const tNucleo = useTranslations('agendaNucleo');

  const opciones: { key: AlcanceActividad; icon: typeof Users; label: string }[] = [
    { key: 'alumnos_seleccionados', icon: UserCheck, label: tNucleo('alcance.alumnos_seleccionados') },
    { key: 'todos_alumnos', icon: Users, label: tNucleo('alcance.todos_alumnos') },
  ];

  return (
    <div className="flex gap-2" role="radiogroup" aria-label={tNucleo('alcance.alumnos_seleccionados')}>
      {opciones.map(({ key, icon: Icon, label }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] disabled:opacity-50 disabled:cursor-not-allowed ${
              selected
                ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
