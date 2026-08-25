'use client';

import { Suspense, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { CalendarOff, CheckCircle, XCircle, ArrowRight, Calendar, Clock, GraduationCap } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { ConfirmacionForm } from '@/components/horarios/ConfirmacionForm';
import { CancelacionForm } from '@/components/horarios/CancelacionForm';
import { SolicitudCambioForm } from '@/components/horarios/SolicitudCambioForm';
import { useAsistencia } from '@/lib/hooks/useAsistencia';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { usePruebas } from '@/lib/hooks/usePruebas';
import { useSolicitudesCambio } from '@/lib/hooks/useSolicitudesCambio';
import { buildAlumnoHorarioDetailHref } from '@/lib/utils/horarioNavigation';
import { useUserStore } from '@/stores/useUserStore';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { RichDescription } from '@/components/common/RichDescription';

function AlumnoDashboardContent() {
  const { user } = useUserStore();
  const { proximas, historial, proximaClase, loading, confirmar, cancelar } = useAsistencia();
  const { data: pruebas = [] } = usePruebas(user?.id);
  const t = useTranslations('horarios');
  const pruebaTerm = usePruebaTerm();
  const tCambio = useTranslations('cambioHorario.estado');
  const td = useTranslations('dashboard.alumno');
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const [modal, setModal] = useState<{ type: 'confirmar' | 'cancelar' | 'cambio'; clase: ClaseAlumno } | null>(null);
  const currentPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const pruebaHorarioIds = useMemo(
    () => new Set(pruebas.filter((p) => p.horario_id).map((p) => p.horario_id!)),
    [pruebas]
  );

  // Notes counts for historial classes
  const notableIds = useMemo(
    () => historial
      .filter((c) => c.estado === 'confirmado' || c.estado === 'no_asistio')
      .slice(0, 5)
      .map((c) => c.horario.id),
    [historial]
  );
  const notasCounts = useNotasCount(notableIds);

  // Check for pending solicitud on the próxima clase (if cancelled)
  const { solicitudes: solicitudesPendientesProxima } = useSolicitudesCambio({
    horario_id: proximaClase?.horario.id,
    estado: 'pendiente',
    enabled: proximaClase?.estado === 'cancelado',
  });
  const hasPendingSolicitud = solicitudesPendientesProxima.length > 0;

  const borderColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'border-[var(--color-brand-gold)]';
      case 'confirmado': return 'border-[var(--color-success)]';
      case 'cancelado':
      case 'cambiado': return 'border-[var(--color-error)]';
      default: return 'border-[var(--color-border)]';
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={td('titulo')} subtitle={td('subtitulo')} />
        <div className="mt-[var(--space-lg)] flex items-center justify-center py-12">
          <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={td('titulo')}
        subtitle={user ? [user.nombre, user.apellido, user.apellido_materno].filter(Boolean).join(' ') : td('subtitulo')}
      />

      <div className="mt-[var(--space-lg)] space-y-[var(--space-lg)]">
        {/* Próxima clase destacada */}
        <section>
          <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">{t('proxima_clase')}</h2>
          {proximaClase ? (
            <Card className={`border-2 ${borderColor(proximaClase.estado)}`} padding="lg">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {proximaClase.horario.titulo}
                      </p>
                      {pruebaHorarioIds.has(proximaClase.horario.id) && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                          <GraduationCap className="size-2.5" />
                          {t('badge_examen', { term: pruebaTerm.singular })}
                        </span>
                      )}
                      {proximaClase.horario.tipo_clase === 'simulacion' && !pruebaHorarioIds.has(proximaClase.horario.id) && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                          <GraduationCap className="size-2.5" />
                          {t('badge_simulacion')}
                        </span>
                      )}
                    </div>
                    {proximaClase.horario.descripcion && (
                      <RichDescription html={proximaClase.horario.descripcion} className="mt-0.5" />
                    )}
                    {proximaClase.horario.profesor && (
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Prof. {proximaClase.horario.profesor.nombre} {proximaClase.horario.profesor.apellido}
                      </p>
                    )}
                  </div>
                  {(() => {
                    const now = new Date();
                    const start = new Date(`${proximaClase.horario.fecha}T${proximaClase.horario.hora_inicio}`);
                    const end = new Date(`${proximaClase.horario.fecha}T${proximaClase.horario.hora_fin}`);
                    const enCurso = proximaClase.estado === 'confirmado' && now >= start && now < end;
                    if (enCurso) {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/50">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {locale === 'en' ? 'In progress' : 'En curso'}
                        </span>
                      );
                    }
                    return <StatusBadge status={proximaClase.estado} />;
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-primary)]">
                    <Calendar className="size-3.5 text-[var(--color-brand-gold)]" />
                    <span className="capitalize">{format(new Date(proximaClase.horario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d, yyyy" : "EEEE d 'de' MMMM 'de' yyyy", { locale: dateFnsLocale })}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-primary)]">
                    <Clock className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
                    {proximaClase.horario.hora_inicio.slice(0, 5)} - {proximaClase.horario.hora_fin.slice(0, 5)}
                  </span>
                </div>

                {/* Aviso de plazo de confirmación */}
                {(() => {
                  const deadlineHours = proximaClase.horario.profesor?.cancellation_deadline_hours ?? 0;
                  const classStart = new Date(`${proximaClase.horario.fecha}T${proximaClase.horario.hora_inicio}`);
                  const deadlineTime = new Date(classStart.getTime() - deadlineHours * 3600 * 1000);
                  const now = new Date();
                  const msDiff = deadlineTime.getTime() - now.getTime();

                  // Solo mostrar aviso cuando la clase aún no empezó y está pendiente/cancelado
                  const isActionable = proximaClase.estado === 'pendiente' || proximaClase.estado === 'cancelado';
                  const classStarted = now >= classStart;
                  if (!isActionable || classStarted) return null;

                  if (deadlineHours === 0) {
                    return (
                      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-sm">
                        <span className="mt-0.5 text-amber-500">⏰</span>
                        <p className="text-amber-700 dark:text-amber-400">
                          {locale === 'en'
                            ? 'If you haven\'t confirmed when the class starts, it will be automatically cancelled.'
                            : 'Si no confirmas al momento en que comience la clase, se marcará como cancelada automáticamente.'}
                        </p>
                      </div>
                    );
                  }

                  if (msDiff <= 0) {
                    return (
                      <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm">
                        <span className="mt-0.5 text-[var(--color-error)]">🔒</span>
                        <p className="text-[var(--color-error)]">
                          {locale === 'en'
                            ? 'The confirmation window has closed. This class will be automatically cancelled if not already confirmed.'
                            : 'El plazo para confirmar ya venció. Esta clase se cancelará automáticamente si no fue confirmada.'}
                        </p>
                      </div>
                    );
                  }

                  const hoursLeft = Math.floor(msDiff / 3600000);
                  const minutesLeft = Math.floor((msDiff % 3600000) / 60000);
                  const deadlineStr = format(deadlineTime, locale === 'en' ? "MMM d 'at' HH:mm" : "d 'de' MMM 'a las' HH:mm", { locale: dateFnsLocale });
                  const timeLeftStr = hoursLeft > 0
                    ? locale === 'en' ? `${hoursLeft}h ${minutesLeft}m` : `${hoursLeft}h ${minutesLeft}m`
                    : locale === 'en' ? `${minutesLeft} minutes` : `${minutesLeft} minutos`;

                  return (
                    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-sm">
                      <span className="mt-0.5 text-amber-500">⏰</span>
                      <div className="text-amber-700 dark:text-amber-400">
                        <p className="font-medium">
                          {locale === 'en'
                            ? `Confirm before ${deadlineStr} (${timeLeftStr} left)`
                            : `Confirma antes del ${deadlineStr} (quedan ${timeLeftStr})`}
                        </p>
                        <p className="text-xs mt-0.5 text-amber-600 dark:text-amber-500">
                          {locale === 'en'
                            ? 'After that, unconfirmed classes are automatically cancelled.'
                            : 'Pasado ese momento, las clases sin confirmar se cancelan automáticamente.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Acciones según estado */}
                {proximaClase.estado === 'pendiente' && (
                  <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <button
                      onClick={() => setModal({ type: 'confirmar', clase: proximaClase })}
                      className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px]"
                    >
                      <CheckCircle className="size-5" />
                      {t('confirmar_asistencia')}
                    </button>
                    <button
                      onClick={() => setModal({ type: 'cancelar', clase: proximaClase })}
                      className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px]"
                    >
                      <XCircle className="size-5" />
                      {t('cancelar_asistencia')}
                    </button>
                  </div>
                )}

                {proximaClase.estado === 'confirmado' && (() => {
                  const now = new Date();
                  const start = new Date(`${proximaClase.horario.fecha}T${proximaClase.horario.hora_inicio}`);
                  const classStarted = now >= start;
                  if (classStarted) return null;
                  return (
                    <div className="mt-2">
                      <button
                        onClick={() => setModal({ type: 'cancelar', clase: proximaClase })}
                        className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px] w-full sm:w-auto"
                      >
                        <XCircle className="size-4" />
                        {t('cancelar_confirmado')}
                      </button>
                    </div>
                  );
                })()}

                {proximaClase.estado === 'cancelado' && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-[var(--color-error)]">{t('cancelaste')}</p>
                    <button
                      onClick={() => setModal({ type: 'confirmar', clase: proximaClase })}
                      className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px] w-full sm:w-auto"
                    >
                      <CheckCircle className="size-4" />
                      {t('confirmar_asistencia')}
                    </button>
                    {hasPendingSolicitud ? (
                      <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 px-4 py-3">
                        <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          {tCambio('solicitud_pendiente')}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setModal({ type: 'cambio', clase: proximaClase })}
                        className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px] w-full sm:w-auto"
                      >
                        <ArrowRight className="size-4" />
                        {t('pedir_otro_horario')}
                      </button>
                    )}
                  </div>
                )}

                {proximaClase.estado === 'cambiado' && (
                  <p className="text-sm text-[var(--color-info)] mt-2">
                    {t('esperando_cambio')}
                  </p>
                )}

                {/* Ver detalles link */}
                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                  <Link
                    href={buildAlumnoHorarioDetailHref(proximaClase.horario.id, currentPath)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-gold)] hover:underline"
                  >
                    {t('ver_detalles')}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarOff className="size-12 text-[var(--color-text-muted)] mb-3" />
              <p className="text-[var(--color-text-primary)] font-medium">{t('sin_proximas')}</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('sin_proximas_subtitulo')}</p>
            </Card>
          )}
        </section>

        {/* Próximas clases */}
        {proximas.length > 1 && (
          <section>
            <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">{t('proximas_clases')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {proximas.slice(1).map((clase) => (
                <Link key={clase.id} href={buildAlumnoHorarioDetailHref(clase.horario.id, currentPath)}>
                  <Card hover>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{clase.horario.titulo}</p>
                        {pruebaHorarioIds.has(clase.horario.id) && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
                            style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                            <GraduationCap className="size-2.5" />
                            {t('badge_examen', { term: pruebaTerm.singular })}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={clase.estado} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                        <Calendar className="size-3 text-[var(--color-brand-gold)]" />
                        <span className="capitalize">{format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "EEE, MMMM d" : "EEE d 'de' MMMM", { locale: dateFnsLocale })}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                        <Clock className="h-3 w-3 text-[var(--color-brand-gold)]" />
                        {clase.horario.hora_inicio.slice(0, 5)} - {clase.horario.hora_fin.slice(0, 5)}
                      </span>
                    </div>
                    {clase.horario.profesor && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                        Prof. {clase.horario.profesor.nombre} {clase.horario.profesor.apellido}
                      </p>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Historial reciente */}
        {historial.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">{t('historial_reciente')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {historial.slice(0, 6).map((clase) => (
                <Link
                  key={clase.id}
                  href={buildAlumnoHorarioDetailHref(clase.horario.id, currentPath)}
                  className="group"
                >
                  <Card hover className="h-full">
                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <div className="shrink-0 mt-1.5">
                        <div className={`size-2.5 rounded-full ${
                          clase.estado === 'confirmado' ? 'bg-[var(--color-success)]'
                          : clase.estado === 'cancelado' || clase.estado === 'no_asistio' ? 'bg-[var(--color-error)]'
                          : clase.estado === 'pendiente' ? 'bg-[var(--color-brand-gold)]'
                          : clase.estado === 'cambiado' ? 'bg-[var(--color-info)]'
                          : 'bg-[var(--color-text-muted)]'
                        }`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {clase.horario.titulo}
                            </p>
                            {pruebaHorarioIds.has(clase.horario.id) && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0"
                                style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                                <GraduationCap className="size-2.5" />
                              </span>
                            )}
                            <NotasIndicator count={notasCounts[clase.horario.id] ?? 0} />
                          </div>
                          <StatusBadge status={clase.estado} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <Calendar className="size-3 text-[var(--color-brand-gold)]" />
                            <span className="capitalize">{format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "MMM d" : "d MMM", { locale: dateFnsLocale })}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                            <Clock className="size-3 text-[var(--color-brand-gold)]" />
                            {clase.horario.hora_inicio.slice(0, 5)}
                          </span>
                        </div>
                        {clase.horario.profesor && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                            Prof. {clase.horario.profesor.nombre} {clase.horario.profesor.apellido}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modales */}
      {modal?.type === 'confirmar' && (
        <ConfirmacionForm clase={modal.clase} onConfirm={confirmar} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'cancelar' && (
        <CancelacionForm clase={modal.clase} onCancel={cancelar} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'cambio' && user && (() => {
        const clase = modal.clase;
        const [h1, m1] = clase.horario.hora_inicio.split(':').map(Number);
        const [h2, m2] = clase.horario.hora_fin.split(':').map(Number);
        const duracionMin = (h2 * 60 + m2) - (h1 * 60 + m1);
        return clase.horario.profesor ? (
          <SolicitudCambioForm
            horarioOriginalId={clase.horario.id}
            profesorId={clase.horario.profesor.id}
            duracionMin={duracionMin}
            onSuccess={() => setModal(null)}
            onCancel={() => setModal(null)}
          />
        ) : null;
      })()}
    </div>
  );
}

export default function AlumnoDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" /></div>}>
      <AlumnoDashboardContent />
    </Suspense>
  );
}
