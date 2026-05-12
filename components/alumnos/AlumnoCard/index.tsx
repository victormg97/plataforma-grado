'use client';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { GraduationCap, KeyRound } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/common/Tooltip';
import type { EstadoAsistencia } from '@/lib/supabase/types';

export type AlumnoConExtra = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  avatar_url?: string | null;
  activo?: boolean;
  rol?: string;
  alumnos_extra: {
    paso_prueba?: boolean;
    profesor_id?: string | null;
    [key: string]: unknown;
  }[] | { paso_prueba?: boolean; profesor_id?: string | null; [key: string]: unknown; } | null;
  proxima_clase?: {
    fecha: string;
    hora_inicio: string;
    estado: EstadoAsistencia;
  } | null;
  profesor_nombre?: string;
  estado_cuenta?: 'Pendiente' | 'Activo';
};

interface AlumnoCardProps {
  alumno: AlumnoConExtra;
  onViewFicha: (alumno: AlumnoConExtra) => void;
  onGestionarAcceso?: (alumno: AlumnoConExtra) => void;
  isOwn?: boolean;
}

export function AlumnoCard({ alumno, onViewFicha, onGestionarAcceso, isOwn = true }: AlumnoCardProps) {
  const t = useTranslations('alumnos');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
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
          <div className="flex size-7 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-sm shadow-lg">
            <GraduationCap className="size-4 text-white" />
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
          <p className="text-xs text-[var(--color-text-muted)]">{t('proxima_clase_label')}:</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {format(new Date(alumno.proxima_clase.fecha), locale === 'en' ? 'EEEE MM/d - HH:mm' : 'EEEE d/MM - HH:mm', { locale: dateFnsLocale })}
          </p>
          <StatusBadge status={alumno.proxima_clase.estado} className="mt-1" />
        </div>
      )}

      {!isOwn && alumno.profesor_nombre && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {t('ficha_asignado_a')}: <span className="font-medium">{alumno.profesor_nombre}</span>
        </p>
      )}

      {isGraduado && (
        <StatusBadge status="graduado" className="mt-2" />
      )}
      {!isGraduado && alumno.estado_cuenta === 'Pendiente' && (
        <StatusBadge status="pendiente" className="mt-2" />
      )}
      {!isGraduado && alumno.estado_cuenta === 'Activo' && (
        <StatusBadge status="confirmado" className="mt-2" />
      )}
      {alumno.activo === false && (
        <StatusBadge status="cancelado" className="mt-2" />
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onViewFicha(alumno); }}>
          {t('ficha_ver_ficha')}
        </Button>
        {onGestionarAcceso && isOwn && (
          <Tooltip content={t('gestionar_acceso')} position="top">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onGestionarAcceso(alumno); }}>
              <KeyRound className="size-4" />
            </Button>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}
