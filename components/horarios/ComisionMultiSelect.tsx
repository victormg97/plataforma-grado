'use client';

/**
 * Multi-select de profesores/admins activos para la comisión evaluadora de una simulación.
 * Solo visible cuando `tipo_clase === 'simulacion'`.
 * Muestra al profesor responsable como implícitamente incluido (badge no deseleccionable).
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface ProfesorComisionOption {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  avatar_url: string | null;
}

export interface ComisionMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  profesorResponsableId: string;
  profesores: ProfesorComisionOption[];
  disabled?: boolean;
  /** When false, hides the "responsable" badge. Default: true. */
  showResponsableBadge?: boolean;
}

export function ComisionMultiSelect({
  selectedIds,
  onChange,
  profesorResponsableId,
  profesores,
  disabled = false,
  showResponsableBadge = true,
}: ComisionMultiSelectProps) {
  const t = useTranslations('horarios');
  const [search, setSearch] = useState('');

  const filteredProfesores = useMemo(() => {
    // When showResponsableBadge is true, exclude the profesor responsable from the selectable list
    const selectable = showResponsableBadge && profesorResponsableId
      ? profesores.filter((p) => p.id !== profesorResponsableId)
      : profesores;
    if (!search.trim()) return selectable;
    const q = search.toLowerCase();
    return selectable.filter(
      (p) => `${p.nombre} ${p.apellido}`.toLowerCase().includes(q),
    );
  }, [profesores, profesorResponsableId, search, showResponsableBadge]);

  const profesorResponsable = useMemo(
    () => showResponsableBadge && profesorResponsableId
      ? profesores.find((p) => p.id === profesorResponsableId)
      : null,
    [profesores, profesorResponsableId, showResponsableBadge],
  );

  function toggleProfesor(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--color-text-primary)]">
        {t('comision_label')}
      </label>

      {/* Profesor responsable badge (always included) */}
      {profesorResponsable && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-gold)]/30 bg-[var(--color-brand-gold-muted)] px-3 py-2">
          {profesorResponsable.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profesorResponsable.avatar_url}
              alt=""
              className="size-6 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-xs font-medium text-white">
              {profesorResponsable.nombre.charAt(0)}
            </span>
          )}
          <span className="text-sm text-[var(--color-text-primary)]">
            {[profesorResponsable.nombre, profesorResponsable.apellido, profesorResponsable.apellido_materno].filter(Boolean).join(' ')}
          </span>
          <span className="ml-auto text-xs text-[var(--color-brand-gold)]">
            {t('comision_incluido')}
          </span>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('comision_placeholder')}
          disabled={disabled}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)] disabled:opacity-50"
        />
      </div>

      {/* Selectable professors list */}
      <div className="max-h-48 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        {filteredProfesores.length === 0 ? (
          <p className="p-3 text-center text-xs text-[var(--color-text-muted)]">
            {t('comision_placeholder')}
          </p>
        ) : (
          filteredProfesores.map((profesor) => {
            const checked = selectedIds.includes(profesor.id);
            return (
              <button
                key={profesor.id}
                type="button"
                onClick={() => toggleProfesor(profesor.id)}
                disabled={disabled}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={checked}
                  className="size-3.5 rounded border-[var(--color-border)] text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]"
                />
                {profesor.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profesor.avatar_url}
                    alt=""
                    className="size-6 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-xs font-medium text-[var(--color-brand-gold)]">
                    {profesor.nombre.charAt(0)}
                  </span>
                )}
                <span className="truncate text-sm text-[var(--color-text-primary)]">
                  {[profesor.nombre, profesor.apellido, profesor.apellido_materno].filter(Boolean).join(' ')}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Selected count */}
      {selectedIds.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          +{selectedIds.length} {t('comision_label').toLowerCase()}
        </p>
      )}
    </div>
  );
}
