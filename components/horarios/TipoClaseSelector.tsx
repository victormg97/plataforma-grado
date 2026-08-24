'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, ClipboardCheck, Scale } from 'lucide-react';

export type TipoClaseValue = 'normal' | 'interrogacion' | 'simulacion';

interface TipoClaseSelectorProps {
  value: TipoClaseValue;
  onChange: (tipo: TipoClaseValue) => void;
  disabled?: boolean;
}

const OPCIONES: { tipo: TipoClaseValue; icon: typeof BookOpen; key: string }[] = [
  { tipo: 'normal', icon: BookOpen, key: 'tipo_clase_normal' },
  { tipo: 'interrogacion', icon: ClipboardCheck, key: 'tipo_clase_interrogacion' },
  { tipo: 'simulacion', icon: Scale, key: 'tipo_clase_simulacion' },
];

export function TipoClaseSelector({ value, onChange, disabled }: TipoClaseSelectorProps) {
  const t = useTranslations('horarios');

  return (
    <div className="flex w-full gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {OPCIONES.map(({ tipo, icon: Icon, key }) => {
        const isActive = value === tipo;
        return (
          <button
            key={tipo}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tipo)}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]',
              disabled ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
            aria-pressed={isActive}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t(key)}</span>
          </button>
        );
      })}
    </div>
  );
}
