'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlumnoAssignmentSelectorProps {
  alumnos: { id: string; nombre: string; apellido: string }[];
  paraTodos: boolean;
  onParaTodosChange: (value: boolean) => void;
  selectedAlumnos: string[];
  onToggleAlumno: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlumnoAssignmentSelector({
  alumnos,
  paraTodos,
  onParaTodosChange,
  selectedAlumnos,
  onToggleAlumno,
}: AlumnoAssignmentSelectorProps) {
  const t = useTranslations('recursos');
  const [alumnoSearch, setAlumnoSearch] = useState('');

  const filteredAlumnos = alumnos.filter((a) =>
    `${a.nombre} ${a.apellido}`.toLowerCase().includes(alumnoSearch.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t('asignar_a')}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { onParaTodosChange(true); }}
          className={cn(
            'flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors',
            paraTodos
              ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
          )}
        >
          {t('todos_alumnos')}
        </button>
        <button
          type="button"
          onClick={() => onParaTodosChange(false)}
          className={cn(
            'flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors',
            !paraTodos
              ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
          )}
        >
          {t('alumnos_especificos')}
        </button>
      </div>

      {!paraTodos && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 space-y-1.5 max-h-44 overflow-y-auto">
          <input
            type="text"
            value={alumnoSearch}
            onChange={(e) => setAlumnoSearch(e.target.value)}
            placeholder={t('buscar_alumno')}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)]"
          />
          {filteredAlumnos.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggleAlumno(a.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors text-left',
                selectedAlumnos.includes(a.id)
                  ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
              )}
            >
              <span className={cn(
                'size-4 rounded border flex items-center justify-center flex-shrink-0',
                selectedAlumnos.includes(a.id)
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]'
                  : 'border-[var(--color-border)]'
              )}>
                {selectedAlumnos.includes(a.id) && <Check className="size-2.5 text-white" />}
              </span>
              {a.nombre} {a.apellido}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
