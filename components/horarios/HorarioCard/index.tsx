'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, User, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';

interface HorarioCardProps {
  horario: HorarioConAsistencia;
  onEdit?: (horario: HorarioConAsistencia) => void;
  onDelete?: (id: string) => void;
}

export function HorarioCard({ horario, onEdit, onDelete }: HorarioCardProps) {
  const estado = horario.asistencia?.[0]?.estado || 'pendiente';

  return (
    <Card hover className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
          <Clock className="h-5 w-5 text-[var(--color-brand-gold)]" />
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{horario.titulo}</p>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <User className="h-3 w-3" />
            <span>{horario.alumno?.nombre} {horario.alumno?.apellido}</span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {format(new Date(horario.fecha), "EEEE d 'de' MMMM", { locale: es })} · {horario.hora_inicio} - {horario.hora_fin}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={estado} />
        {onEdit && (
          <button onClick={() => onEdit(horario)} className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)]">
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(horario.id)} className="rounded p-1.5 text-[var(--color-error)] transition-colors hover:bg-red-50 dark:hover:bg-red-950/20">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  );
}
