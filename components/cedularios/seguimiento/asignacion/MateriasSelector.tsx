'use client';

/**
 * Materia picker of the assign dialog.
 * Two modes in a radio group: "all materias" (default, resolved on the server at the moment of
 * the operation) or "choose materias" on top of SubconjuntoArbol.
 * The component is controlled. The value is `'todas'` or the list of selected materia ids.
 * In "choose" mode an empty selection shows a validation error and flags the group as invalid.
 */

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useMateriasTree } from '@/components/cedularios/hooks/useMaterias';
import { SubconjuntoArbol } from '../subconjunto/SubconjuntoArbol';

/** Value of the picker: every active materia, or an explicit list of materia ids. */
export type SeleccionMaterias = 'todas' | string[];

interface MateriasSelectorProps {
  /** Cedulario whose materia tree is shown in "choose" mode. */
  cedularioId: string | null | undefined;
  value: SeleccionMaterias;
  onChange: (value: SeleccionMaterias) => void;
  /** Ids of materias that hold progress data (marker in the tree). */
  conAvance?: ReadonlySet<string>;
  disabled?: boolean;
  /** Shows the empty-selection error even before the user touched the picker (failed submit). */
  forzarError?: boolean;
  className?: string;
}

type ModoMaterias = 'todas' | 'elegir';

export function MateriasSelector({
  cedularioId,
  value,
  onChange,
  conAvance,
  disabled = false,
  forzarError = false,
  className,
}: MateriasSelectorProps) {
  const t = useTranslations('cedularios.seguimiento');
  const baseId = useId();
  const nombreGrupo = `${baseId}-modo`;
  const idError = `${baseId}-error`;
  const idAyuda = `${baseId}-ayuda`;

  const modo: ModoMaterias = value === 'todas' ? 'todas' : 'elegir';
  const [tocado, setTocado] = useState(false);

  // Remembers the last explicit selection so switching modes back and forth does not lose it.
  const ultimaSeleccion = useRef<string[]>([]);

  // The tree is fetched only when it is shown.
  const arbol = useMateriasTree(modo === 'elegir' ? cedularioId : null);

  const seleccion = useMemo<ReadonlySet<string>>(
    () => new Set(value === 'todas' ? [] : value),
    [value],
  );

  const cambiarModo = (siguiente: ModoMaterias) => {
    if (siguiente === modo) return;
    if (value !== 'todas') ultimaSeleccion.current = value;
    onChange(siguiente === 'todas' ? 'todas' : [...ultimaSeleccion.current]);
  };

  const cambiarSeleccion = useCallback(
    (siguiente: Set<string>) => {
      const ids = Array.from(siguiente);
      ultimaSeleccion.current = ids;
      setTocado(true);
      onChange(ids);
    },
    [onChange],
  );

  const vacia = modo === 'elegir' && seleccion.size === 0;
  const mostrarError = vacia && (tocado || forzarError);
  const flat = arbol.data ?? [];
  const hayMaterias = flat.some((materia) => materia.activo);

  const claseOpcion =
    'flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] has-[:checked]:border-[var(--color-brand-gold)] has-[:checked]:bg-[var(--color-brand-gold-muted)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-brand-gold)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';

  return (
    <fieldset
      disabled={disabled}
      aria-invalid={mostrarError}
      aria-describedby={mostrarError ? `${idAyuda} ${idError}` : idAyuda}
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <legend className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">
        {t('asignar.materias.etiqueta')}
      </legend>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={claseOpcion}>
          <input
            type="radio"
            name={nombreGrupo}
            checked={modo === 'todas'}
            onChange={() => cambiarModo('todas')}
            className="size-4 shrink-0 accent-[var(--color-brand-gold)]"
          />
          <span>{t('asignar.materias.todas')}</span>
        </label>
        <label className={claseOpcion}>
          <input
            type="radio"
            name={nombreGrupo}
            checked={modo === 'elegir'}
            onChange={() => cambiarModo('elegir')}
            className="size-4 shrink-0 accent-[var(--color-brand-gold)]"
          />
          <span>{t('asignar.materias.elegir')}</span>
        </label>
      </div>

      <p id={idAyuda} className="text-xs text-[var(--color-text-muted)]">
        {t('asignar.materias.ayuda')}
      </p>

      {modo === 'elegir' && (
        <div className="flex min-w-0 flex-col gap-2">
          {arbol.isPending && Boolean(cedularioId) && (
            <p role="status" className="text-sm text-[var(--color-text-muted)]">
              {t('comun.cargando')}
            </p>
          )}

          {arbol.isError && (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p className="text-sm text-[var(--color-error)]">{t('comun.error_carga')}</p>
              <button
                type="button"
                onClick={() => void arbol.refetch()}
                className="rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-brand-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
              >
                {t('comun.reintentar')}
              </button>
            </div>
          )}

          {arbol.isSuccess && !hayMaterias && (
            <p className="text-sm text-[var(--color-text-muted)]">{t('comun.materias_conteo', { count: 0 })}</p>
          )}

          {arbol.isSuccess && hayMaterias && (
            <div className="max-h-80 overflow-y-auto rounded-[var(--radius-md)]">
              <SubconjuntoArbol
                flat={flat}
                seleccion={seleccion}
                onChange={cambiarSeleccion}
                conAvance={conAvance}
                disabled={disabled}
              />
            </div>
          )}

          <div className="flex flex-col gap-0.5 text-xs" aria-live="polite">
            <span className="text-[var(--color-text-muted)]">
              {t('asignar.materias.seleccionadas', { count: seleccion.size })}
            </span>
            {mostrarError && (
              <span id={idError} role="alert" className="text-[var(--color-error)]">
                {t('asignar.materias.error_vacia')}
              </span>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
}
