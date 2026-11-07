'use client';

/**
 * Single-choice cedulario picker of the assign dialog (fixed student mode).
 * Lists the active cedularios grouped by universidad with a name search, and shows
 * disabled the ones the student already has an active assignment of ("ya asignado").
 * Reuses the phase 1 list query (`useCedularios`) and `filtrarCedularios`.
 */

import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  SEARCH_MAX_LENGTH,
  filtrarCedularios,
  type CedularioListItem,
} from '@/lib/cedularios/busqueda';
import { useCedularios } from '@/components/cedularios/hooks/useCedularios';
import { useDebouncedValue } from '@/components/cedularios/hooks/useDebouncedValue';

interface CedularioPickerSelectorProps {
  /** Selected cedulario id, or null when nothing is chosen. */
  value: string | null;
  onChange: (cedularioId: string) => void;
  /** Cedulario ids the student already has with an active assignment (shown disabled). */
  idsAsignados: ReadonlySet<string> | readonly string[];
  disabled?: boolean;
  className?: string;
}

interface GrupoUniversidad {
  id: string;
  nombre: string;
  items: CedularioListItem[];
}

/** Groups cedularios by universidad, groups and items sorted by name. */
function agruparPorUniversidad(items: CedularioListItem[]): GrupoUniversidad[] {
  const grupos = new Map<string, GrupoUniversidad>();
  for (const item of items) {
    const grupo = grupos.get(item.universidadId);
    if (grupo) {
      grupo.items.push(item);
    } else {
      grupos.set(item.universidadId, {
        id: item.universidadId,
        nombre: item.universidadNombre,
        items: [item],
      });
    }
  }
  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      items: [...grupo.items].sort((a, b) => collator.compare(a.nombre, b.nombre)),
    }))
    .sort((a, b) => collator.compare(a.nombre, b.nombre));
}

export function CedularioPickerSelector({
  value,
  onChange,
  idsAsignados,
  disabled = false,
  className,
}: CedularioPickerSelectorProps) {
  const t = useTranslations('cedularios.seguimiento');
  const baseId = useId();
  const [texto, setTexto] = useState('');
  const textoAplicado = useDebouncedValue(texto);
  const { data, isPending, isError, refetch } = useCedularios();

  const asignados = useMemo(() => new Set(idsAsignados), [idsAsignados]);

  const grupos = useMemo(() => {
    const activos = (data ?? []).filter((cedulario) => cedulario.activo);
    return agruparPorUniversidad(filtrarCedularios(activos, textoAplicado, null));
  }, [data, textoAplicado]);

  const nombreGrupo = (grupo: GrupoUniversidad) =>
    grupo.nombre.trim() !== '' ? grupo.nombre : t('asignar.cedulario.sin_universidad');

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <span id={`${baseId}-etiqueta`} className="text-sm font-medium text-[var(--color-text-primary)]">
        {t('asignar.cedulario.etiqueta')}
      </span>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={texto}
          maxLength={SEARCH_MAX_LENGTH}
          disabled={disabled}
          onChange={(event) => setTexto(event.target.value)}
          placeholder={t('asignar.cedulario.buscar_placeholder')}
          aria-label={t('asignar.cedulario.buscar_aria')}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:opacity-50"
        />
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${baseId}-etiqueta`}
        aria-busy={isPending}
        className="max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]"
      >
        {isPending && (
          <p role="status" className="p-[var(--space-sm)] text-sm text-[var(--color-text-muted)]">
            {t('comun.cargando')}
          </p>
        )}

        {isError && (
          <div role="alert" className="flex flex-col items-start gap-2 p-[var(--space-sm)]">
            <p className="text-sm text-[var(--color-error)]">{t('comun.error_carga')}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-brand-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
            >
              {t('comun.reintentar')}
            </button>
          </div>
        )}

        {!isPending && !isError && grupos.length === 0 && (
          <p className="p-[var(--space-sm)] text-sm text-[var(--color-text-muted)]">
            {t('asignar.cedulario.sin_resultados')}
          </p>
        )}

        {!isPending &&
          !isError &&
          grupos.map((grupo) => (
            <div key={grupo.id} role="presentation">
              <p className="sticky top-0 bg-[var(--color-bg-secondary)] px-[var(--space-sm)] py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {nombreGrupo(grupo)}
              </p>
              {grupo.items.map((cedulario) => {
                const yaAsignado = asignados.has(cedulario.id);
                const deshabilitado = disabled || yaAsignado;
                const inputId = `${baseId}-${cedulario.id}`;
                return (
                  <label
                    key={cedulario.id}
                    htmlFor={inputId}
                    className={cn(
                      'flex items-center gap-3 px-[var(--space-sm)] py-2 text-sm transition-colors',
                      deshabilitado
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer hover:bg-[var(--color-bg-secondary)]',
                      value === cedulario.id && 'bg-[var(--color-brand-gold-muted)]',
                    )}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`${baseId}-cedulario`}
                      checked={value === cedulario.id}
                      disabled={deshabilitado}
                      onChange={() => onChange(cedulario.id)}
                      className="size-4 shrink-0 accent-[var(--color-brand-gold)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">
                      {cedulario.nombre}
                      {cedulario.version.trim() !== '' && (
                        <span className="text-[var(--color-text-muted)]"> · {cedulario.version}</span>
                      )}
                    </span>
                    {yaAsignado && (
                      <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                        {t('asignar.cedulario.ya_asignado')}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
