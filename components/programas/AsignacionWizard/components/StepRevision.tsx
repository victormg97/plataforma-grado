'use client';

import { User, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ClaseItem } from '@/lib/supabase/types';

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

export interface StepRevisionProps {
  horariosPorAlumno: HorarioAlumno[];
  alumnos: AlumnoOption[];
  clasesOrdenadas: ClaseItem[];
  t: ReturnType<typeof useTranslations<'programas'>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepRevision({ horariosPorAlumno, alumnos, clasesOrdenadas, t }: StepRevisionProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-text-muted)]">{t('wizard.resumen_intro')}</p>
      {horariosPorAlumno.map((h) => {
        const alumnoInfo = alumnos.find((a) => a.id === h.alumno_id);
        return (
          <div key={h.alumno_id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="size-4 text-[var(--color-brand-gold)]" />
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {alumnoInfo?.nombre} {alumnoInfo?.apellido}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {h.clases.map((c) => {
                const clase = clasesOrdenadas.find((cl) => cl.id === c.clase_id);
                return (
                  <div key={c.clase_id} className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Calendar className="size-3 shrink-0" />
                    <span className="font-medium text-[var(--color-text-primary)]">{clase?.nombre}</span>
                    <span>{c.fecha.split('-').reverse().join('-')} {c.hora_inicio}–{c.hora_fin}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
