'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { GraduationCap } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import type { Profile, AlumnoExtra, EstadoAsistencia } from '@/lib/supabase/types';

export type AlumnoConExtra = Profile & {
  alumnos_extra: AlumnoExtra[] | AlumnoExtra | null;
  proxima_clase?: {
    fecha: string;
    hora_inicio: string;
    estado: EstadoAsistencia;
  } | null;
  profesor_nombre?: string;
};

interface AlumnoCardProps {
  alumno: AlumnoConExtra;
  onViewFicha: (alumno: AlumnoConExtra) => void;
  isOwn?: boolean;
}

export function AlumnoCard({ alumno, onViewFicha, isOwn = true }: AlumnoCardProps) {
  const extra = Array.isArray(alumno.alumnos_extra)
    ? alumno.alumnos_extra[0]
    : alumno.alumnos_extra;
  const isGraduado = extra?.paso_prueba === true;

  return (
    <Card
      hover
      className={`relative transition-all ${isGraduado ? 'border-[var(--color-brand-gold)] shadow-[0_0_12px_rgba(201,153,63,0.15)]' : ''}`}
      onClick={() => onViewFicha(alumno)}
    >
      {isGraduado && (
        <div className="absolute -right-1 -top-1 animate-pulse">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-sm shadow-lg">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar
          nombre={alumno.nombre}
          apellido={alumno.apellido}
          avatarUrl={alumno.avatar_url}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--color-text-primary)]">
            {alumno.nombre} {alumno.apellido}
          </p>
          <p className="truncate text-sm text-[var(--color-text-muted)]">{alumno.email}</p>
        </div>
      </div>

      {alumno.proxima_clase && (
        <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] p-2">
          <p className="text-xs text-[var(--color-text-muted)]">Próxima clase:</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {format(new Date(alumno.proxima_clase.fecha), "EEEE d/MM - HH:mm", { locale: es })}
          </p>
          <StatusBadge status={alumno.proxima_clase.estado} className="mt-1" />
        </div>
      )}

      {!isOwn && alumno.profesor_nombre && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Asignado a: <span className="font-medium">{alumno.profesor_nombre}</span>
        </p>
      )}

      {isGraduado && (
        <StatusBadge status="graduado" className="mt-2" />
      )}

      <div className="mt-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); onViewFicha(alumno); }}>
          Ver ficha
        </Button>
      </div>
    </Card>
  );
}
