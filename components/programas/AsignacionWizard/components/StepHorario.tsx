'use client';

import { User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ClaseItem } from '@/lib/supabase/types';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlumnoOption = {
  id: string;
  nombre: string;
  apellido: string;
  avatar_url?: string | null;
};

type HorarioClase = {
  clase_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
};

type HorarioAlumno = {
  alumno_id: string;
  clases: HorarioClase[];
};

export interface StepHorarioProps {
  alumnoInfo: AlumnoOption | undefined;
  horarioClases: HorarioAlumno;
  clasesOrdenadas: ClaseItem[];
  currentIndex: number;
  totalAlumnos: number;
  onUpdateHorario: (claseId: string, field: keyof HorarioClase, value: string) => void;
  t: ReturnType<typeof useTranslations<'programas'>>;
  pruebaTerm: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepHorario({
  alumnoInfo,
  horarioClases,
  clasesOrdenadas,
  currentIndex,
  totalAlumnos,
  onUpdateHorario,
  t,
  pruebaTerm,
}: StepHorarioProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-3 py-2">
        <User className="size-4 text-[var(--color-brand-gold)]" />
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {alumnoInfo?.nombre} {alumnoInfo?.apellido}
        </span>
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">
          {currentIndex + 1} / {totalAlumnos}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {clasesOrdenadas.map((clase, idx) => {
          const h = horarioClases.clases.find((c) => c.clase_id === clase.id);
          return (
            <div key={clase.id || idx} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{clase.nombre}</span>
                {clase.tipo === 'prueba' && (
                  <span className="ml-auto rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs text-[var(--color-brand-gold)]">
                    {t('editor.prueba', { term: pruebaTerm })}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-muted)]">{t('wizard.fecha')}</label>
                  <input
                    type="date"
                    value={h?.fecha ?? ''}
                    onChange={(e) => onUpdateHorario(clase.id, 'fecha', e.target.value)}
                    className="h-8 rounded border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 text-xs outline-none focus:border-[var(--color-brand-gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-muted)]">{t('wizard.hora_inicio')}</label>
                  <input
                    type="time"
                    value={h?.hora_inicio ?? ''}
                    onChange={(e) => onUpdateHorario(clase.id, 'hora_inicio', e.target.value)}
                    className="h-8 rounded border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 text-xs outline-none focus:border-[var(--color-brand-gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-muted)]">{t('wizard.hora_fin')}</label>
                  <input
                    type="time"
                    value={h?.hora_fin ?? ''}
                    onChange={(e) => onUpdateHorario(clase.id, 'hora_fin', e.target.value)}
                    className="h-8 rounded border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 text-xs outline-none focus:border-[var(--color-brand-gold)]"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
