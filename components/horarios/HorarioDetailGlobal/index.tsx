'use client';

import { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esDateFns } from 'date-fns/locale';
import { Calendar, Clock, FileText, MessageSquare, ExternalLink, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { Button } from '@/components/common/Button';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';

export function HorarioDetailGlobal() {
  const { horarioDetailId, setHorarioDetailId } = useUIStore();
  const { user } = useUserStore();
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('asistencia');
  const [horario, setHorario] = useState<HorarioConAsistencia | null>(null);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const userRol: 'profesor' | 'admin' = user?.rol === 'admin' ? 'admin' : 'profesor';
  const notasCounts = useNotasCount(horarioDetailId ? [horarioDetailId] : []);

  useEffect(() => {
    if (!horarioDetailId) return;
    let cancelled = false;
    startTransition(() => setLoading(true));
    fetch(`/api/horarios/${horarioDetailId}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setHorario(data); })
      .catch(() => { if (!cancelled) setHorario(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [horarioDetailId]);

  const isVisible = user?.rol === 'profesor' || user?.rol === 'admin';

  if (!isVisible) return null;

  function handleClose() {
    setHorarioDetailId(null);
  }

  return (
    <Modal
      open={!!horarioDetailId}
      onClose={handleClose}
      title={loading ? tc('cargando') : (horario?.titulo || t('editar_clase'))}
      footer={
        <Button variant="ghost" onClick={handleClose}>{tc('cerrar')}</Button>
      }
    >
      {loading && (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          {tc('cargando')}
        </div>
      )}

      {!loading && horario && (
        <div className="space-y-4">
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

          {/* Estado */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">{ta('estado_label')}:</span>
            <StatusBadge status={horario.asistencia?.[0]?.estado || 'pendiente'} />
            <NotasIndicator count={notasCounts[horario.id] ?? 0} />
            {(horario.pruebas?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                <GraduationCap className="h-3 w-3" />
                {t('badge_examen')}
              </span>
            )}
          </div>

          {/* Date / time badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
              <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--color-brand-gold)' }} />
              <span className="capitalize">
                {format(new Date(horario.fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: esDateFns })}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
              <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-brand-gold)' }} />
              {horario.hora_inicio.slice(0, 5)} - {horario.hora_fin.slice(0, 5)}
            </span>
          </div>

          {/* Descripcion */}
          {horario.descripcion && (
            <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{horario.descripcion}</p>
            </div>
          )}

          {/* Nota del alumno */}
          {horario.asistencia?.[0]?.nota_alumno && (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                <MessageSquare className="h-3.5 w-3.5" />
                {ta('nota_alumno_title')}
              </div>
              <p className="text-sm text-[var(--color-text-primary)]">
                {horario.asistencia[0].nota_alumno}
              </p>
            </div>
          )}

          {/* Link to detail page */}
          <Link
            href={buildClaseDetailHref(horario.id, userRol, pathname)}
            className="flex items-center gap-1.5 text-sm text-[var(--color-brand-gold)] hover:underline"
            onClick={handleClose}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('ver_detalle_completo')}
          </Link>
        </div>
      )}
    </Modal>
  );
}
