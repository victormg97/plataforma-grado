'use client';

import { useTranslations } from 'next-intl';
import { Clock, FileText, MessageSquare, GraduationCap } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { EstadoAsistencia } from '@/lib/supabase/types';
import type { ReactNode } from 'react';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';

interface EventDetailHorario {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  alumno: { id: string; nombre: string; apellido: string; email: string; avatar_url: string | null } | null;
  asistencia: { id: string; estado: string; nota_alumno: string | null }[];
}

interface EventDetailModalProps {
  open: boolean;
  onClose: () => void;
  horario: EventDetailHorario | null;
  isExamen?: boolean;
  /** Footer buttons */
  footer: ReactNode;
  /** Extra content rendered before the alumno row (e.g. profesor badge in admin) */
  headerSlot?: ReactNode;
  /** Extra content rendered after estado row (e.g. NotasIndicator, links) */
  afterEstadoSlot?: ReactNode;
  /** Custom date/time rendering. If not provided, uses simple format. */
  dateTimeSlot?: ReactNode;
  /** Extra content at the bottom (e.g. link to detail page) */
  bottomSlot?: ReactNode;
}

export function EventDetailModal({
  open,
  onClose,
  horario,
  isExamen = false,
  footer,
  headerSlot,
  afterEstadoSlot,
  dateTimeSlot,
  bottomSlot,
}: EventDetailModalProps) {
  const t = useTranslations('horarios');
  const ta = useTranslations('asistencia');
  const pruebaTerm = usePruebaTerm();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={horario?.titulo || t('editar_clase')}
      footer={footer}
    >
      {horario && (
        <div className="space-y-4">
          {/* Optional header slot (e.g. profesor badge) */}
          {headerSlot}

          {/* Alumno */}
          <div className="flex items-center gap-3">
            <Avatar
              nombre={horario.alumno?.nombre || ''}
              apellido={horario.alumno?.apellido || ''}
              avatarUrl={horario.alumno?.avatar_url}
              size="md"
            />
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">
                {horario.alumno?.nombre} {horario.alumno?.apellido}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {horario.alumno?.email}
              </p>
            </div>
          </div>

          {/* Estado + exam badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">{ta('estado_label')}:</span>
            <StatusBadge status={(horario.asistencia?.[0]?.estado as EstadoAsistencia) || 'pendiente'} />
            {isExamen && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: 'var(--color-brand-gold-muted)',
                  borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)',
                  color: 'var(--color-brand-gold)',
                }}
              >
                <GraduationCap className="size-3" />
                {t('badge_examen', { term: pruebaTerm.singular })}
              </span>
            )}
            {afterEstadoSlot}
          </div>

          {/* Date/time */}
          {dateTimeSlot ?? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Clock className="size-4" />
              <span>{horario.fecha} · {horario.hora_inicio.slice(0, 5)} - {horario.hora_fin.slice(0, 5)}</span>
            </div>
          )}

          {/* Descripcion */}
          {horario.descripcion && (
            <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <FileText className="mt-0.5 size-4 shrink-0" />
              <RichDescription html={horario.descripcion} />
            </div>
          )}

          {/* Nota del alumno */}
          {horario.asistencia?.[0]?.nota_alumno && (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                <MessageSquare className="size-3.5" />
                {ta('nota_alumno_title')}
              </div>
              <p className="text-sm text-[var(--color-text-primary)]">
                {horario.asistencia[0].nota_alumno}
              </p>
            </div>
          )}

          {/* Optional bottom slot (e.g. link to detail page) */}
          {bottomSlot}
        </div>
      )}
    </Modal>
  );
}
