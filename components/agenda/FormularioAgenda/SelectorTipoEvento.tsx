'use client';

/**
 * Selector de tipo de evento para el FormularioAgenda.
 * Muestra tres opciones (Clase, Entrada Personal, Actividad) como grupo de botones/tabs.
 * Solo composición, sin lógica de negocio (Req 17.8).
 */
import { useTranslations } from 'next-intl';
import { BookOpen, CalendarDays, Users } from 'lucide-react';

export type TipoEvento = 'clase' | 'entrada_personal' | 'actividad';

interface SelectorTipoEventoProps {
  value: TipoEvento;
  onChange: (tipo: TipoEvento) => void;
}

const TIPOS: { tipo: TipoEvento; icon: typeof BookOpen; key: string }[] = [
  { tipo: 'clase', icon: BookOpen, key: 'selector_tipo_clase' },
  { tipo: 'entrada_personal', icon: CalendarDays, key: 'selector_tipo_entrada_personal' },
  { tipo: 'actividad', icon: Users, key: 'selector_tipo_actividad' },
];

export function SelectorTipoEvento({ value, onChange }: SelectorTipoEventoProps) {
  const t = useTranslations('agendaNucleo');

  return (
    <div className="flex w-full gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {TIPOS.map(({ tipo, icon: Icon, key }) => {
        const isActive = value === tipo;
        return (
          <button
            key={tipo}
            type="button"
            onClick={() => onChange(tipo)}
            className={[
              'flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]',
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
