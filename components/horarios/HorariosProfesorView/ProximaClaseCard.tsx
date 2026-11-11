'use client';

import { isToday, isTomorrow } from 'date-fns';
import type { Locale } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import { ClaseAlumnoLink, ClaseCardShell, ClaseExamenBadge } from './ClaseCardBase';
import { ClaseCardAcciones } from './ClaseCardAcciones';
import { FechaTile } from './FechaTile';

function DayBadge({ fecha }: { fecha: string }) {
  const t = useTranslations('horarios');
  const d = new Date(`${fecha}T12:00:00`);
  if (isToday(d)) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--color-brand-gold)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {t('hoy_badge')}
      </span>
    );
  }
  if (isTomorrow(d)) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent-fg)]">
        {t('proxima_badge')}
      </span>
    );
  }
  return null;
}

interface ProximaClaseCardProps {
  horario: HorarioConAsistencia;
  indice: number;
  isFirst: boolean;
  isExamen: boolean;
  dateFnsLocale: Locale;
  alumnoBasePath: string;
  fromPath: string;
  role: 'profesor' | 'admin';
  onEdit: () => void;
  onDelete: () => void;
}

/** Vertical card of an upcoming class, for the responsive grid. */
export function ProximaClaseCard({
  horario,
  indice,
  isFirst,
  isExamen,
  dateFnsLocale,
  alumnoBasePath,
  fromPath,
  role,
  onEdit,
  onDelete,
}: ProximaClaseCardProps) {
  const estado = horario.asistencia?.[0]?.estado ?? 'pendiente';

  return (
    <ClaseCardShell indice={indice} destacada={isFirst} onEdit={onEdit}>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <FechaTile fecha={horario.fecha} dateFnsLocale={dateFnsLocale} destacada={isFirst} />
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={estado} />
            <DayBadge fecha={horario.fecha} />
          </div>
        </div>

        <ClaseAlumnoLink
          alumno={horario.alumno}
          href={horario.alumno ? `${alumnoBasePath}/${horario.alumno.id}?from=${encodeURIComponent(fromPath)}` : ''}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <p className="min-w-0 truncate text-sm text-[var(--color-text-secondary)]">{horario.titulo}</p>
          {isExamen && <ClaseExamenBadge />}
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
          <Clock className="size-3.5 shrink-0 text-[var(--color-brand-gold)]" />
          {horario.hora_inicio.slice(0, 5)} – {horario.hora_fin.slice(0, 5)}
        </span>
      </div>

      <ClaseCardAcciones
        detalleHref={buildClaseDetailHref(horario.id, role, fromPath)}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </ClaseCardShell>
  );
}
