'use client';

import { Check, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlumnoOption = {
  id: string;
  nombre: string;
  apellido: string;
  avatar_url?: string | null;
};

export interface StepAlumnosProps {
  alumnos: AlumnoOption[];
  selectedAlumnos: string[];
  onToggle: (id: string) => void;
  emptyMessage: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepAlumnos({ alumnos, selectedAlumnos, onToggle, emptyMessage }: StepAlumnosProps) {
  return (
    <div className="flex flex-col gap-2">
      {alumnos.map((alumno) => {
        const selected = selectedAlumnos.includes(alumno.id);
        return (
          <button
            key={alumno.id}
            type="button"
            onClick={() => onToggle(alumno.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors',
              selected
                ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-brand-gold)]/50'
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
              <User className="size-4 text-[var(--color-text-muted)]" />
            </div>
            <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)]">
              {alumno.nombre} {alumno.apellido}
            </span>
            {selected && <Check className="size-4 text-[var(--color-brand-gold)]" />}
          </button>
        );
      })}
      {alumnos.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}
