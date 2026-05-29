'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';
import { Calendar, Clock, FileText, MessageSquare, ArrowLeft, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import { NotasSection } from '@/components/notas/NotasSection';
import { AppSelect } from '@/components/common/AppSelect';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { getClaseDetailBackHref } from '@/lib/utils/horarioNavigation';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { useCalificarPrueba } from '@/lib/hooks/usePruebas';

const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors'
);

interface PruebaWithGrade {
  id: string;
  nombre: string;
  estado: string;
  nota?: number | null;
  observaciones?: string | null;
}

function GradeInlineForm({ 
  horario, 
  tc, 
  th 
}: { 
  horario: HorarioConAsistencia; 
  tc: ReturnType<typeof useTranslations>; 
  th: ReturnType<typeof useTranslations>; 
}) {
  const prueba = (horario.pruebas as PruebaWithGrade[] | undefined)?.[0];
  const [nota, setNota] = useState<string>(prueba?.nota != null ? prueba.nota.toFixed(1) : '');
  const { mutateAsync: calificar, isPending } = useCalificarPrueba();

  if (!prueba) return null;

  async function handleSave() {
    if (!prueba) return;
    const finalStr = nota.trim().replace(',', '.');
    if (finalStr === '') {
      try {
        await calificar({ id: prueba.id, nota: null, observaciones: prueba.observaciones });
        toast.success(tc('exito'));
      } catch(e: unknown) {
        toast.error(e instanceof Error ? e.message : tc('error'));
      }
      return;
    }

    const notaNum = parseFloat(finalStr);
    if (isNaN(notaNum) || notaNum < 1.0 || notaNum > 7.0) {
      toast.error('La nota debe estar entre 1.0 y 7.0');
      return;
    }
    
    setNota(notaNum.toFixed(1));

    try {
      const res = await calificar({ id: prueba.id, nota: notaNum, observaciones: prueba.observaciones });
      toast.success(tc('exito'));
      if (res.needs_scheduling) {
        toast.warning(th('agendar_reintento'), { duration: 8000 });
      }
    } catch(e: unknown) {
      toast.error(e instanceof Error ? e.message : tc('error'));
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 w-full">
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 w-[90px]">
            <label className="block text-[13px] font-semibold text-[var(--color-text-secondary)]">
              {th('nota_prueba')}
            </label>
            <input
              type="text"
          value={nota}
          onChange={(e) => {
            let val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
            
            // Allow empty string to delete
            if (val === '') {
              setNota('');
              return;
            }

            // Strip leading zeros unless it's strictly "0."
            if (val.startsWith('0') && !val.startsWith('0.')) {
              val = val.substring(1);
            }

            // Prevent starting with .
            if (val.startsWith('.')) {
              val = '';
            }

            // Limit decimals to exactly 1 position
            if (val.includes('.')) {
               const parts = val.split('.');
               val = `${parts[0]}.${parts[1].substring(0, 1)}`;
            }

            // If length is 2 and no decimal, auto convert
            if (val.length === 2 && !val.includes('.')) {
               const num = parseInt(val);
               if (num >= 10 && num <= 70) {
                 val = `${val[0]}.${val[1]}`;
               } else if (num > 70) {
                 val = '7.0';
               } else if (num < 10) {
                 // user typed something weird like "09" which became "9"
                 val = `${val[0]}.0`; 
               }
            }

            // Over limits hard caps
            const f = parseFloat(val);
            if (!isNaN(f)) {
               if (f > 7.0) val = '7.0';
               // If it's something complete like "0.5", convert to 1.0
               if (val.length >= 3 && f < 1.0) val = '1.0';
            }

            if (val.length > 3) {
               val = val.substring(0, 3);
            }

            // Remove trailing dot if exists (e.g., from deleting the decimal)
            if (val.endsWith('.')) {
               val = val.substring(0, val.length - 1);
            }

            setNota(val);
          }}
          placeholder="Ej: 5.5"
          className={`${inputCls} text-center font-bold text-lg px-2 shadow-inner`}
        />
      </div>

      <Button variant="primary" loading={isPending} onClick={handleSave} disabled={isPending} className="h-10 font-semibold px-5 shadow-sm">
         {prueba?.nota != null ? th('actualizar_nota') : th('guardar_nota')}
      </Button>
    </div>
      
    <div className="hidden sm:block flex-1"></div>

    {(() => {
      // Evaluate visual UI badge using local unsaved `nota` state instead of DB state
      // If empty string and was never originally saved, don't show badge
      if (nota === '' && !prueba.nota) return null;
      
      const localNum = parseFloat(nota);
      if (isNaN(localNum)) return null;

      const isAprobado = localNum >= 4.0;
      return (
        <div className="flex h-10 items-center justify-center rounded-full px-5 font-bold text-[13px] shadow-sm ml-auto sm:ml-0"
             style={{ 
               backgroundColor: isAprobado ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'color-mix(in srgb, var(--color-error) 15%, transparent)',
               color: isAprobado ? 'var(--color-success)' : 'var(--color-error)',
               border: `1px solid color-mix(in srgb, ${isAprobado ? 'var(--color-success)' : 'var(--color-error)'} 30%, transparent)`
             }}>
          {th(isAprobado ? 'aprobado' : 'reprobado')}
        </div>
      );
    })()}

    </div>
  </div>
  );
}

type ClaseDetailViewProps = {
  rol: 'profesor' | 'admin';
};

export function ClaseDetailView({ rol }: ClaseDetailViewProps) {
  const [horarioId] = useQueryParam('id');
  const [from] = useQueryParam('from');
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('asistencia');
  const pruebaTerm = usePruebaTerm();
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : esDateFns;
  const backHref = getClaseDetailBackHref(from, rol);
  const queryClient = useQueryClient();
  const [changingEstado, setChangingEstado] = useState(false);

  const { data: horario = null, isLoading: loading, isError: error } = useQuery<HorarioConAsistencia | null>({
    queryKey: ['horario-detail', horarioId],
    queryFn: async () => {
      const r = await fetch(`/api/horarios/${horarioId}`);
      if (!r.ok) throw new Error('Not found');
      return r.json();
    },
    enabled: !!horarioId,
    staleTime: 30_000,
  });

  const notasCounts = useNotasCount(horarioId ? [horarioId] : []);

  const estado = horario?.asistencia?.[0]?.estado || 'pendiente';
  const asistenciaId = horario?.asistencia?.[0]?.id;
  const today = new Date().toISOString().split('T')[0];
  const isPast = horario ? horario.fecha < today : false;
  const showNotas = horario && (estado === 'confirmado' || estado === 'no_asistio') && isPast;

  // Status change options for profesor/admin
  const estadoOptions = [
    { value: 'pendiente', label: ta('estados.pendiente') },
    { value: 'confirmado', label: ta('estados.confirmado') },
    { value: 'cancelado', label: ta('estados.cancelado') },
    { value: 'no_asistio', label: ta('estados.no_asistio') },
  ];

  const handleEstadoChange = async (newEstado: string) => {
    if (!asistenciaId || newEstado === estado) return;
    setChangingEstado(true);
    try {
      const res = await fetch(`/api/asistencia/${asistenciaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newEstado }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Error al cambiar estado');
      }
      toast.success(ta('estado_actualizado'));
      queryClient.invalidateQueries({ queryKey: ['horario-detail', horarioId] });
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setChangingEstado(false);
    }
  };

  const borderColor = () => {
    switch (estado) {
      case 'confirmado': return 'border-[var(--color-success)]';
      case 'cancelado':
      case 'cambiado': return 'border-[var(--color-error)]';
      case 'no_asistio': return 'border-[var(--color-text-muted)]';
      default: return 'border-[var(--color-brand-gold)]';
    }
  };

  // Loading
  if (loading) {
    return (
      <div>
        <PageHeader title={t('detalle_clase')} subtitle="" />
        <div className="mt-[var(--space-lg)] flex items-center justify-center py-12">
          <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      </div>
    );
  }

  // No id param or not found
  if (!horarioId || error || !horario) {
    return (
      <div>
        <PageHeader title={t('detalle_clase')} subtitle="" />
        <div className="mt-[var(--space-lg)]">
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[var(--color-text-primary)] font-medium">{t('clase_no_encontrada')}</p>
            <Link href={backHref} className="mt-3 text-sm text-[var(--color-brand-gold)] hover:underline flex items-center gap-1">
              <ArrowLeft className="size-4" /> {tc('volver')}
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={horario.titulo}
        subtitle={t('detalle_clase')}
        actions={
          <Link href={backHref} className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <ArrowLeft className="size-4" /> {tc('volver')}
          </Link>
        }
      />

      <div className="mt-[var(--space-lg)] space-y-[var(--space-md)]">
        <Card className={`border-2 ${borderColor()}`} padding="lg">
          <div className="space-y-4">
            {/* Exam banner */}
            {(horario.pruebas?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5"
                style={{ backgroundColor: 'var(--color-brand-gold-muted)', border: '1px solid color-mix(in srgb, var(--color-brand-gold) 40%, transparent)' }}>
                <GraduationCap className="size-4 shrink-0" style={{ color: 'var(--color-brand-gold)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-brand-gold)' }}>{t('es_examen', { term: pruebaTerm.singular })}</span>
              </div>
            )}
            {/* Student info */}
            {horario.alumno && (
              <div className="flex items-center gap-3">
                <Avatar
                  nombre={horario.alumno.nombre}
                  apellido={horario.alumno.apellido}
                  avatarUrl={horario.alumno.avatar_url}
                  size="md"
                />
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {horario.alumno.nombre} {horario.alumno.apellido}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {horario.alumno.email}
                  </p>
                </div>
              </div>
            )}

            {/* Status + notes indicator + change control */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--color-text-muted)]">{ta('estado_label')}:</span>
              <StatusBadge status={estado} />
              <NotasIndicator count={notasCounts[horario.id] ?? 0} />
              {(horario.pruebas?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                  <GraduationCap className="size-3" />
                  {t('badge_examen', { term: pruebaTerm.singular })}
                </span>
              )}
            </div>

            {/* Profesor/Admin: change attendance status */}
            {asistenciaId && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-[var(--color-text-muted)]">{ta('cambiar_estado')}:</span>
                <AppSelect
                  value={estado}
                  onChange={handleEstadoChange}
                  options={estadoOptions}
                  disabled={changingEstado}
                  className="min-w-[160px]"
                />
              </div>
            )}

            {/* Date / time */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Calendar className="size-4 text-[var(--color-brand-gold)]" />
                <span className="capitalize">
                  {format(new Date(horario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d yyyy" : "EEEE d 'de' MMMM yyyy", { locale: dateFnsLocale })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Clock className="h-4 w-4 text-[var(--color-brand-gold)]" />
                <span>{horario.hora_inicio.slice(0, 5)} - {horario.hora_fin.slice(0, 5)}</span>
              </div>
            </div>

            {/* Description */}
            {horario.descripcion && (
              <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{horario.descripcion}</p>
              </div>
            )}

            {/* Student note */}
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

            {/* Prueba Grading */}
            {(horario.pruebas?.length ?? 0) > 0 && (
              <GradeInlineForm horario={horario} tc={tc} th={t} />
            )}
          </div>
        </Card>

        {/* Class notes */}
        {showNotas && (
          <Card padding="lg">
            <NotasSection horarioId={horario.id} />
          </Card>
        )}
      </div>
    </div>
  );
}
