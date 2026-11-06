'use client';

/**
 * Selector múltiple de personas con búsqueda, pensado para vivir dentro del
 * panel del Filtro_Agenda. Cada clic en una fila alterna su selección y se
 * notifica de inmediato (no hay botón «aplicar»).
 */

import { useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Search, X } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import {
  nombreCompleto,
  normalizarBusqueda,
  ordenarPersonas,
  type PersonaFiltro,
} from './personas';

interface SelectorPersonasProps {
  titulo: string;
  icono: ReactNode;
  placeholderBusqueda: string;
  personas: PersonaFiltro[];
  /** Ids seleccionados. Vacío = sin filtrar (se muestra a todos). */
  seleccionados: string[];
  onAlternar: (id: string) => void;
  onLimpiar: () => void;
  /** Se ordena primero y se marca con «(tú)». */
  usuarioActualId?: string;
  className?: string;
}

export function SelectorPersonas({
  titulo,
  icono,
  placeholderBusqueda,
  personas,
  seleccionados,
  onAlternar,
  onLimpiar,
  usuarioActualId,
  className,
}: SelectorPersonasProps) {
  const t = useTranslations('agendaCalendario');
  const [busqueda, setBusqueda] = useState('');
  const inputId = useId();

  const ordenadas = useMemo(
    () => ordenarPersonas(personas, usuarioActualId),
    [personas, usuarioActualId],
  );

  const visibles = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    if (!q) return ordenadas;
    return ordenadas.filter((p) =>
      normalizarBusqueda(`${nombreCompleto(p)} ${p.detalle ?? ''}`).includes(q),
    );
  }, [ordenadas, busqueda]);

  const seleccion = useMemo(() => new Set(seleccionados), [seleccionados]);
  const hayBusqueda = busqueda.trim().length > 0;

  return (
    <section className={cn('flex min-w-0 flex-col gap-2', className)} aria-label={titulo}>
      {/* Cabecera: título, estado y atajo para quitar la selección */}
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          <span className="shrink-0 text-[var(--color-text-muted)]" aria-hidden>
            {icono}
          </span>
          <span className="truncate">{titulo}</span>
        </h3>
        {seleccionados.length > 0 ? (
          <button
            type="button"
            onClick={onLimpiar}
            className="shrink-0 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)] transition-colors hover:bg-[var(--color-brand-gold-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
          >
            {t('filtro_quitar_seleccion', { count: seleccionados.length })}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
            {t('filtro_mostrando_todos')}
          </span>
        )}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {placeholderBusqueda}
        </label>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={placeholderBusqueda}
          autoComplete="off"
          // 16px en móvil evita el zoom automático de iOS al enfocar.
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] pl-9 pr-9 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-strong)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/30 sm:h-9 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {hayBusqueda && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            aria-label={t('filtro_borrar_busqueda')}
            className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Lista */}
      <ul
        aria-label={titulo}
        className="max-h-44 space-y-0.5 overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1 sm:max-h-60"
      >
        {visibles.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
            {personas.length === 0 ? t('filtro_lista_vacia') : t('filtro_sin_resultados')}
          </li>
        ) : (
          visibles.map((persona) => {
            const activa = seleccion.has(persona.id);
            const esUsuario = persona.id === usuarioActualId;
            return (
              <li key={persona.id}>
                <button
                  type="button"
                  aria-pressed={activa}
                  onClick={() => onAlternar(persona.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-gold)] sm:py-1.5',
                    activa
                      ? 'bg-[var(--color-brand-gold-muted)]'
                      : 'hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-secondary)]',
                  )}
                >
                  <Avatar
                    nombre={persona.nombre}
                    apellido={persona.apellido}
                    avatarUrl={persona.avatar_url}
                    size="sm"
                    className="size-8 shrink-0 text-[11px] sm:size-7 sm:text-[10px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'truncate text-sm',
                          activa
                            ? 'font-semibold text-[var(--color-text-primary)]'
                            : 'text-[var(--color-text-primary)]',
                        )}
                      >
                        {nombreCompleto(persona)}
                      </span>
                      {esUsuario && (
                        <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                          {t('filtro_yo')}
                        </span>
                      )}
                      {persona.rol === 'admin' && (
                        <span className="shrink-0 rounded-full bg-[var(--color-bg-elevated)] px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                          {t('filtro_rol_admin')}
                        </span>
                      )}
                    </span>
                    {persona.detalle && (
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {persona.detalle}
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border transition-colors',
                      activa
                        ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-[var(--color-brand-black)]'
                        : 'border-[var(--color-border-strong)] bg-transparent',
                    )}
                  >
                    {activa && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
