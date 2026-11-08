'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, GraduationCap, Scale } from 'lucide-react';
import { ClaseDescripcion } from '@/components/horarios/ClaseDescripcion';
import { ClaseFechaHora } from '@/components/horarios/ClaseFechaHora';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { AlumnoHoverCard } from '@/components/cedularios/seguimiento/hover/AlumnoHoverCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { AppSelect } from '@/components/common/AppSelect';
import { Button } from '@/components/common/Button';
import { ViewDetailButton } from '@/components/horarios/ViewDetailButton';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import { SimulacionEvaluacionCard, type EvaluacionData } from '@/components/horarios/SimulacionEvaluacionCard';
import type { TipoClase } from '@/lib/supabase/types';
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
      size="xl"
      contentClassName="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={handleClose}>{tc('cerrar')}</Button>
          {horario && (
            <ViewDetailButton
              compact
              href={buildClaseDetailHref(horario.id, userRol, pathname)}
              onClick={handleClose}
            />
          )}
        </div>
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
          <AlumnoHoverCard alumno={horario.alumno} className="flex items-center gap-3">
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
          </AlumnoHoverCard>

          {/* Estado */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">{ta('estado_label')}:</span>
            <StatusBadge status={horario.asistencia?.[0]?.estado || 'pendiente'} />
            <NotasIndicator count={notasCounts[horario.id] ?? 0} />
            {(horario as HorarioDetailWithSimulacion).tipo_clase === 'simulacion' && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                <Scale className="size-3" />
                {t('simulacion_badge')}
              </span>
            )}
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
          <ClaseFechaHora fecha={horario.fecha} horaInicio={horario.hora_inicio} horaFin={horario.hora_fin} />

          {/* Descripcion */}
          {horario.descripcion && <ClaseDescripcion html={horario.descripcion} />}

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

          {/* Simulación section — comisión + evaluaciones */}
          {(horario as HorarioDetailWithSimulacion).tipo_clase === 'simulacion' && (
            <SimulacionSection horario={horario as HorarioDetailWithSimulacion} userId={user?.id ?? ''} queryClient={queryClient} horarioDetailId={horarioDetailId} />
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Simulación Detail Types ──────────────────────────────────────────────────

interface HorarioDetailWithSimulacion extends HorarioConAsistencia {
  tipo_clase?: TipoClase;
  simulacion_comision?: {
    id: string;
    profesor_id: string;
    profesor: { id: string; nombre: string; apellido: string; apellido_materno?: string | null; avatar_url: string | null };
  }[];
  simulacion_evaluaciones?: {
    id: string;
    profesor_id: string;
    profesor: { id: string; nombre: string; apellido: string; apellido_materno?: string | null };
    nota: number | null;
    feedback: string | null;
    estado: 'pendiente' | 'calificada';
  }[];
}

// ─── Simulación Section Component ─────────────────────────────────────────────

function SimulacionSection({
  horario,
  userId,
  queryClient,
  horarioDetailId,
}: {
  horario: HorarioDetailWithSimulacion;
  userId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  horarioDetailId: string | null;
}) {
  const t = useTranslations('horarios');

  const comision = horario.simulacion_comision ?? [];
  const evaluaciones = horario.simulacion_evaluaciones ?? [];

  async function handleEvaluacionSubmit(evaluacionId: string, data: { nota: number | null; feedback: string | null }) {
    try {
      const res = await fetch(`/api/simulacion-evaluaciones/${evaluacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, estado: 'calificada' }),
      });
      if (!res.ok) throw new Error('Error');
      queryClient.invalidateQueries({ queryKey: ['horario-detail-global', horarioDetailId] });
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
    } catch {
      // Error handled silently — toast could be added
    }
  }

  return (
    <div className="space-y-3">
      {/* Comisión members */}
      {comision.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
            {t('comision_label')}
          </p>
          <div className="flex flex-wrap gap-2">
            {comision.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1">
                <Avatar
                  nombre={c.profesor.nombre}
                  apellido={c.profesor.apellido}
                  avatarUrl={c.profesor.avatar_url}
                  size="sm"
                />
                <span className="text-xs text-[var(--color-text-primary)]">
                  {[c.profesor.nombre, c.profesor.apellido, c.profesor.apellido_materno].filter(Boolean).join(' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluaciones */}
      {evaluaciones.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
            {t('evaluacion_titulo')}
          </p>
          <div className="space-y-2">
            {evaluaciones.map((ev) => (
              <SimulacionEvaluacionCard
                key={ev.id}
                evaluacion={ev as EvaluacionData}
                isOwner={ev.profesor_id === userId}
                onSubmit={(data) => handleEvaluacionSubmit(ev.id, data)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
