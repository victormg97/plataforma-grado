'use client';

import { useState } from 'react';
import { Check, Globe, Users, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Visibility mode for a resource */
export type VisibilidadMode = 'mis_alumnos' | 'todos_app' | 'especificos';

export interface AlumnoAssignmentSelectorProps {
  alumnos: { id: string; nombre: string; apellido: string }[];
  /** Current visibility mode */
  mode: VisibilidadMode;
  onModeChange: (mode: VisibilidadMode) => void;
  selectedAlumnos: string[];
  onToggleAlumno: (id: string) => void;
  /** When true, show the "todos mis alumnos" option (profesor).
   *  When false (admin), show "todos los alumnos" instead of "todos mis alumnos". */
  showMisAlumnos?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlumnoAssignmentSelector({
  alumnos,
  mode,
  onModeChange,
  selectedAlumnos,
  onToggleAlumno,
  showMisAlumnos = true,
}: AlumnoAssignmentSelectorProps) {
  const t = useTranslations('recursos');
  const [alumnoSearch, setAlumnoSearch] = useState('');

  const filteredAlumnos = alumnos.filter((a) =>
    `${a.nombre} ${a.apellido}`.toLowerCase().includes(alumnoSearch.toLowerCase())
  );

  const options: { value: VisibilidadMode; Icon: React.ElementType; label: string }[] = [
    {
      value: 'mis_alumnos',
      Icon: Users,
      label: showMisAlumnos ? t('todos_mis_alumnos') : t('todos_alumnos'),
    },
    {
      value: 'todos_app',
      Icon: Globe,
      label: t('todos_app'),
    },
    {
      value: 'especificos',
      Icon: Building2,
      label: t('alumnos_especificos'),
    },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('asignar_a')}
      </label>

      {/* Three-option selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(({ value, Icon, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-2.5 text-xs font-medium transition-colors text-center',
              mode === value
                ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Hint for todos_app */}
      {mode === 'todos_app' && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('todos_app_desc')}
        </p>
      )}

      {/* Alumno picker for especificos */}
      {mode === 'especificos' && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 space-y-1.5 max-h-44 overflow-y-auto">
          <input
            type="text"
            value={alumnoSearch}
            onChange={(e) => setAlumnoSearch(e.target.value)}
            placeholder={t('buscar_alumno')}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)]"
          />
          {filteredAlumnos.length === 0 ? (
            <p className="py-3 text-center text-xs text-[var(--color-text-muted)]">{t('sin_alumnos')}</p>
          ) : (
            filteredAlumnos.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onToggleAlumno(a.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors text-left',
                  selectedAlumnos.includes(a.id)
                    ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                )}
              >
                <span className={cn(
                  'size-4 rounded border flex items-center justify-center flex-shrink-0',
                  selectedAlumnos.includes(a.id)
                    ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]'
                    : 'border-[var(--color-border)]',
                )}>
                  {selectedAlumnos.includes(a.id) && <Check className="size-2.5 text-white" />}
                </span>
                {a.nombre} {a.apellido}
              </button>
            ))
          )}
        </div>
      )}

      {mode === 'especificos' && selectedAlumnos.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('solo_asignados', { count: selectedAlumnos.length })}
        </p>
      )}
    </div>
  );
}
