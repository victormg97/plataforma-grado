'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esDateFns } from 'date-fns/locale';
import { Calendar, Clock, FileText, MessageSquare, GraduationCap } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { AppSelect } from '@/components/common/AppSelect';
import { Button } from '@/components/common/Button';
import { ViewDetailButton } from '@/components/horarios/ViewDetailButton';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';

export function HorarioDetailGlobal() {
  const { horarioDetailId, setHorarioDetailId } = useUIStore();
  const { user } = useUserStore();
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('asistencia');
  const pruebaTerm = usePruebaTerm();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const userRol: 'profesor' | 'admin' = user?.rol === 'admin' ? 'admin' : 'profesor';
  const notasCounts = useNotasCount(horarioDetailId ? [horarioDetailId] : []);
  const [changingEstado, setChangingEstado] = useState(false);

  const { data: horario = null, isLoading: loading } = useQuery<HorarioConAsistencia | null>({
    queryKey: ['horario-detail-global', horarioDetailId],
    queryFn: async () => {
      const r = await fetch(`/api/horarios/${horarioDetailId}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!horarioDetailId,
    staleTime: 30_000,
  });

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
                <GraduationCap className="size-3" />
                {t('badge_examen', { term: pruebaTerm.singular })}
              </span>
            )}
          </div>

          {/* Change attendance status */}
          {horario.asistencia?.[0]?.id && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-[var(--color-text-muted)]">{ta('cambiar_estado')}:</span>
              <AppSelect
                value={horario.asistencia[0].estado || 'pendiente'}
                onChange={async (newEstado) => {
                  const asistId = horario.asistencia![0].id;
                  if (newEstado === horario.asistencia![0].estado) return;
                  setChangingEstado(true);
                  try {
                    const res = await fetch(`/api/asistencia/${asistId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ estado: newEstado }),
                    });
                    if (!res.ok) {
                      const body = await res.json().catch(() => null);
                      throw new Error(body?.error || 'Error');
                    }
                    toast.success(ta('estado_actualizado'));
                    queryClient.invalidateQueries({ queryKey: ['horario-detail-global', horarioDetailId] });
                    queryClient.invalidateQueries({ queryKey: ['horarios'] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Error');
                  } finally {
                    setChangingEstado(false);
                  }
                }}
                options={[
                  { value: 'pendiente', label: ta('estados.pendiente') },
                  { value: 'confirmado', label: ta('estados.confirmado') },
                  { value: 'cancelado', label: ta('estados.cancelado') },
                  { value: 'no_asistio', label: ta('estados.no_asistio') },
                ]}
                disabled={changingEstado}
                className="min-w-[160px]"
              />
            </div>
          )}

          {/* Date / time badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
              <Calendar className="size-3.5" style={{ color: 'var(--color-brand-gold)' }} />
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

          {/* Link to detail page */}
          <ViewDetailButton
            href={buildClaseDetailHref(horario.id, userRol, pathname)}
            onClick={handleClose}
          />
        </div>
      )}
    </Modal>
  );
}
