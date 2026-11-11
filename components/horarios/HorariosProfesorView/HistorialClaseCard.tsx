'use client';

import { format } from 'date-fns';
import type { Locale } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import { ClaseAlumnoLink, ClaseCardShell, ClaseExamenBadge } from './ClaseCardBase';
import { ClaseCardAcciones } from './ClaseCardAcciones';
import { FechaTile } from './FechaTile';

interface HistorialClaseCardProps {
  horario: HorarioConAsistencia;
  indice: number;
  isExamen: boolean;
  dateFnsLocale: Locale;
  notasCount: number;
  alumnoBasePath: string;
  fromPath: string;
  role: 'profesor' | 'admin';
  onEdit: () => void;
  onDelete: () => void;
}

/** Vertical card of a past class, for the responsive grid. */
export function HistorialClaseCard({
  horario,
  indice,
  isExamen,
  dateFnsLocale,
  notasCount,
  alumnoBasePath,
  fromPath,
  role,
  onEdit,
  onDelete,
}: HistorialClaseCardProps) {
  const estado = horario.asistencia?.[0]?.estado ?? 'pendiente';
  const anio = format(new Date(`${horario.fecha}T12:00:00`), 'yyyy');

  return (
    <ClaseCardShell indice={indice} onEdit={onEdit}>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <FechaTile fecha={horario.fecha} dateFnsLocale={dateFnsLocale} />
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={estado} />
            {notasCount > 0 && <NotasIndicator count={notasCount} />}
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

        <div className="flex flex-wrap gap-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5">
            <Clock className="size-3 shrink-0 text-[var(--color-brand-gold)]" />
            {horario.hora_inicio.slice(0, 5)}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5">
            {anio}
          </span>
        </div>
      </div>

      <ClaseCardAcciones
        detalleHref={buildClaseDetailHref(horario.id, role, fromPath)}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </ClaseCardShell>
  );
}
