'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { usePersistedOpen } from '@/lib/hooks/usePersistedOpen';

interface ClaseDetalleCollapsibleProps {
  /** Unique per user + class; open state is persisted in localStorage under it. */
  storageKey: string;
  /** Always-visible header content (title, badges). */
  header: ReactNode;
  /** Short line shown only while collapsed. */
  summary?: ReactNode;
  /** Border color class for the card. */
  borderClass?: string;
  children: ReactNode;
}

/** Card with an always-visible header and a body that collapses; open by default. */
export function ClaseDetalleCollapsible({
  storageKey,
  header,
  summary,
  borderClass = 'border-[var(--color-border)]',
  children,
}: ClaseDetalleCollapsibleProps) {
  const t = useTranslations('horarios.fecha_hora');
  const [open, setOpen] = usePersistedOpen(storageKey, true);
  const bodyId = useId();

  return (
    <div className={`overflow-hidden rounded-[var(--radius-lg)] border-2 bg-[var(--color-bg)] shadow-[var(--shadow-sm)] ${borderClass}`}>
      <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          {header}
          {!open && summary && <div className="mt-2">{summary}</div>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? t('colapsar_detalle') : t('expandir_detalle')}
          title={open ? t('colapsar_detalle') : t('expandir_detalle')}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronDown className={`size-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div
        id={bodyId}
        hidden={!open}
        className="space-y-4 border-t border-[var(--color-border)] px-5 py-5 sm:px-6"
      >
        {children}
      </div>
    </div>
  );
}
