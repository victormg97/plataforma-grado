'use client';

/**
 * Toolbar of the Revisor tree: search box, filter chips, result counter and the
 * "no results" indicator with the "Clear filters" action.
 * All state lives in the URL (`seg_filtro`, `seg_q`) through `useSegUrl`.
 */

import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { SEG_BUSQUEDA_MAX } from '@/lib/cedularios/seguimiento/constants';
import { cn } from '@/lib/utils';
import { useBusquedaSegUrl } from '../hooks/useBusquedaSegUrl';
import { useSegUrl } from '../url/useSegUrl';
import { FiltroChips } from './FiltroChips';

interface RevisionToolbarProps {
  /** Number of assigned materias that meet the active filter and search. */
  total: number;
  className?: string;
}

export function RevisionToolbar({ total, className }: RevisionToolbarProps) {
  const t = useTranslations('cedularios.seguimiento.revision');
  const { estado, fijar } = useSegUrl();
  const { texto, setTexto, limpiar } = useBusquedaSegUrl();
  const entrada = useRef<HTMLInputElement>(null);

  const hayBusqueda = estado.q.trim() !== '';
  const hayRestriccion = hayBusqueda || estado.filtro !== 'todas';
  const sinResultados = hayRestriccion && total === 0;

  const limpiarTodo = () => {
    limpiar();
    fijar({ filtro: 'todas' });
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <Input
          ref={entrada}
          type="text"
          inputMode="search"
          autoComplete="off"
          maxLength={SEG_BUSQUEDA_MAX}
          value={texto}
          placeholder={t('buscar_placeholder')}
          aria-label={t('buscar_aria')}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && texto !== '') {
              // Clear the search first; a second Escape reaches the overlay.
              event.preventDefault();
              event.stopPropagation();
              limpiar();
            }
          }}
          className="h-9 pl-8 pr-9"
        />
        {texto !== '' && (
          <button
            type="button"
            aria-label={t('limpiar_busqueda')}
            title={t('limpiar_busqueda')}
            onClick={() => {
              limpiar();
              entrada.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      <FiltroChips value={estado.filtro} onChange={(filtro) => fijar({ filtro })} />

      <div aria-live="polite" className="min-h-5 text-sm">
        {hayRestriccion && (
          <p className="text-[var(--color-text-muted)]">{t('resultados', { count: total })}</p>
        )}
      </div>

      {sinResultados && (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">{t('sin_resultados')}</p>
          <Button type="button" variant="secondary" size="sm" onClick={limpiarTodo}>
            {t('limpiar_filtros')}
          </Button>
        </div>
      )}
    </div>
  );
}
