'use client';

/**
 * Selector de visibilidad para entradas personales de agenda.
 *
 * Un toggle/radio entre `privada` y `publica`, con iconos Lock/Globe y labels
 * desde `agendaVisibilidad.opcion_privada / opcion_publica`.
 *
 * Requisitos: 8.1, 15.1, 15.2
 */
import { Lock, Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { AgendaVisibilidad } from '@/lib/supabase/types';

export interface SelectorVisibilidadProps {
  value: AgendaVisibilidad;
  onChange: (value: AgendaVisibilidad) => void;
  disabled?: boolean;
}

export function SelectorVisibilidad({
  value,
  onChange,
  disabled = false,
}: SelectorVisibilidadProps) {
  const t = useTranslations('agendaVisibilidad');

  const opciones: { key: AgendaVisibilidad; icon: typeof Lock; label: string }[] = [
    { key: 'privada', icon: Lock, label: t('opcion_privada') },
    { key: 'publica', icon: Globe, label: t('opcion_publica') },
  ];

  return (
    <div className="flex gap-2" role="radiogroup" aria-label={t('label')}>
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
