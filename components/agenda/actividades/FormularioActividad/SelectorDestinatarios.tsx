'use client';

/**
 * Multi-select de alumnos para elegir los destinatarios de una actividad.
 *
 * Se monta solo cuando el alcance es `alumnos_seleccionados`. Muestra una lista
 * filtrable con checkboxes; el profesor solo ve sus alumnos asignados, el admin
 * ve todos los alumnos activos (la lista la decide el padre mediante la prop
 * `alumnos`).
 *
 * Requisitos: 4.1, 4.3, 4.4, 15.1, 15.2
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface AlumnoOption {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  avatar_url: string | null;
}

export interface SelectorDestinatariosProps {
  alumnos: AlumnoOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function SelectorDestinatarios({
  alumnos,
  selectedIds,
  onChange,
  disabled = false,
}: SelectorDestinatariosProps) {
  const t = useTranslations('agendaActividades');
  const [search, setSearch] = useState('');

  const filteredAlumnos = useMemo(() => {
    if (!search.trim()) return alumnos;
    const q = search.toLowerCase();
    return alumnos.filter(
      (a) =>
        `${a.nombre} ${a.apellido}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q),
    );
  }, [alumnos, search]);

  function toggleAlumno(id: string) {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function toggleAll() {
    if (disabled) return;
    const allFilteredIds = filteredAlumnos.map((a) => a.id);
    const allSelected = allFilteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !allFilteredIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...allFilteredIds]);
      onChange([...merged]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {t('campo_destinatarios')}
        </span>
        {selectedIds.length > 0 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {t('todos_seleccionados', { cantidad: selectedIds.length })}
          </span>
        )}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('campo_destinatarios_placeholder')}
          disabled={disabled}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)] disabled:opacity-50"
        />
      </div>

      {/* Alumno list */}
      <div className="max-h-48 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        {filteredAlumnos.length === 0 ? (
          <p className="p-3 text-center text-xs text-[var(--color-text-muted)]">
            {t('campo_destinatarios_placeholder')}
          </p>
        ) : (
          <>
            {/* Select all toggle */}
            {filteredAlumnos.length > 1 && (
              <button
                type="button"
                onClick={toggleAll}
                disabled={disabled}
                className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-left text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={filteredAlumnos.every((a) => selectedIds.includes(a.id))}
                  className="size-3.5 rounded border-[var(--color-border)] text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]"
                />
                {t('campo_alcance')}
              </button>
            )}
            {filteredAlumnos.map((alumno) => {
              const checked = selectedIds.includes(alumno.id);
              return (
                <button
                  key={alumno.id}
                  type="button"
                  onClick={() => toggleAlumno(alumno.id)}
                  disabled={disabled}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={checked}
                    className="size-3.5 rounded border-[var(--color-border)] text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]"
                  />
                  {/* Avatar */}
                  {alumno.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={alumno.avatar_url}
                      alt=""
                      className="size-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-xs font-medium text-[var(--color-brand-gold)]">
                      {alumno.nombre.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--color-text-primary)]">
                      {alumno.nombre} {alumno.apellido}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {alumno.email}
                    </p>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
