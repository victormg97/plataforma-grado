'use client';

/**
 * Multiple-choice student picker of the assign dialog (fixed cedulario mode).
 * Lists the active students the user can assign the cedulario to (a professor sees only
 * their own students, an admin sees all), with a debounced search and "load more" pages.
 * Students that already have an active assignment are shown disabled ("ya asignado").
 * The selection is a list of ids that survives searches; it is capped at 200 students.
 */

import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/common/Avatar';
import { SEG_BUSQUEDA_MAX, MAX_ALUMNOS_POR_ASIGNACION } from '@/lib/cedularios/seguimiento/constants';
import type { AlumnoAsignable } from '@/lib/queries/cedularios/seguimiento/asignables';
import { useAlumnosAsignables } from '../hooks/useAlumnosAsignables';

interface AlumnosSelectorProps {
  /** Cedulario the students will be assigned to. */
  cedularioId: string | null | undefined;
  /** Selected student ids. */
  value: readonly string[];
  onChange: (alumnoIds: string[]) => void;
  /** Maximum number of students that can be selected. */
  max?: number;
  disabled?: boolean;
  /** Set to false to keep the query idle (for example while the dialog is closed). */
  enabled?: boolean;
  className?: string;
}

function nombreCompleto(alumno: AlumnoAsignable): string {
  return [alumno.nombre, alumno.apellido, alumno.apellidoMaterno ?? '']
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '')
    .join(' ');
}

export function AlumnosSelector({
  cedularioId,
  value,
  onChange,
  max = MAX_ALUMNOS_POR_ASIGNACION,
  disabled = false,
  enabled = true,
  className,
}: AlumnosSelectorProps) {
  const t = useTranslations('cedularios.seguimiento');
  const baseId = useId();
  const [texto, setTexto] = useState('');
  const { data, isPending, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useAlumnosAsignables(cedularioId, texto, { enabled });

  const seleccionados = useMemo(() => new Set(value), [value]);
  const alumnos = data?.items ?? [];
  const limiteAlcanzado = seleccionados.size >= max;
  const sinBusqueda = texto.trim() === '';

  const alternar = (alumnoId: string) => {
    if (seleccionados.has(alumnoId)) {
      onChange(value.filter((id) => id !== alumnoId));
    } else if (!limiteAlcanzado) {
      onChange([...value, alumnoId]);
    }
  };

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <span id={`${baseId}-etiqueta`} className="text-sm font-medium text-[var(--color-text-primary)]">
        {t('asignar.alumnos.etiqueta')}
      </span>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={texto}
          maxLength={SEG_BUSQUEDA_MAX}
          disabled={disabled}
          onChange={(event) => setTexto(event.target.value)}
          placeholder={t('asignar.alumnos.buscar_placeholder')}
          aria-label={t('asignar.alumnos.buscar_aria')}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:opacity-50"
        />
      </div>

      <div
        role="group"
        aria-labelledby={`${baseId}-etiqueta`}
        aria-busy={isPending}
        className="max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]"
      >
        {isPending && enabled && Boolean(cedularioId) && (
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

        {!isPending && !isError && alumnos.length === 0 && (
          <p className="p-[var(--space-sm)] text-sm text-[var(--color-text-muted)]">
            {sinBusqueda ? t('asignar.alumnos.sin_alumnos_a_cargo') : t('asignar.alumnos.sin_resultados')}
          </p>
        )}

        {!isError && alumnos.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {alumnos.map((alumno) => {
              const marcado = seleccionados.has(alumno.id);
              const bloqueadoPorLimite = limiteAlcanzado && !marcado;
              const deshabilitado = disabled || alumno.yaAsignado || bloqueadoPorLimite;
              const inputId = `${baseId}-${alumno.id}`;
              const nombre = nombreCompleto(alumno);
              return (
                <li key={alumno.id}>
                  <label
                    htmlFor={inputId}
                    className={cn(
                      'flex items-center gap-3 px-[var(--space-sm)] py-2 text-sm transition-colors',
                      deshabilitado
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer hover:bg-[var(--color-bg-secondary)]',
                      marcado && 'bg-[var(--color-brand-gold-muted)]',
                    )}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={marcado}
                      disabled={deshabilitado}
                      onChange={() => alternar(alumno.id)}
                      className="size-4 shrink-0 accent-[var(--color-brand-gold)]"
                    />
                    <Avatar
                      nombre={alumno.nombre}
                      apellido={alumno.apellido}
                      avatarUrl={alumno.avatarUrl}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-[var(--color-text-primary)]">
                        {nombre !== '' ? nombre : t('comun.alumno_sin_nombre')}
                      </span>
                      <span className="truncate text-xs text-[var(--color-text-muted)]">{alumno.email}</span>
                    </span>
                    {alumno.yaAsignado && (
                      <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                        {t('asignar.alumnos.ya_asignado')}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {hasNextPage && (
          <div className="border-t border-[var(--color-border)] p-[var(--space-xs)]">
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage || disabled}
              className="w-full rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-[var(--color-brand-gold)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:opacity-50"
            >
              {isFetchingNextPage ? t('comun.cargando') : t('asignar.alumnos.cargar_mas')}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 text-xs text-[var(--color-text-muted)]" aria-live="polite">
        <span>{t('asignar.alumnos.seleccionados', { count: seleccionados.size })}</span>
        {limiteAlcanzado && <span>{t('asignar.alumnos.limite', { max })}</span>}
      </div>
    </div>
  );
}
