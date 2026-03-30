'use client';

import { Suspense, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Calendar, Clock, User, ArrowLeft, CheckCircle, XCircle, ArrowRight, CalendarOff } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmacionForm } from '@/components/horarios/ConfirmacionForm';
import { CancelacionForm } from '@/components/horarios/CancelacionForm';
import { CambioHorarioForm } from '@/components/horarios/CambioHorarioForm';
import { useAsistencia } from '@/lib/hooks/useAsistencia';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { useUserStore } from '@/stores/useUserStore';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';
import { useTranslations, useLocale } from 'next-intl';

/* ── List view (no ?id= param) ── */
function HorarioListView({ clases, loading }: { clases: ClaseAlumno[]; loading: boolean }) {
  const t = useTranslations('horarios');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const today = new Date().toISOString().split('T')[0];

  const upcoming = useMemo(
    () => clases
      .filter((c) => c.horario.fecha >= today && c.horario.activo)
      .sort((a, b) => a.horario.fecha.localeCompare(b.horario.fecha) || a.horario.hora_inicio.localeCompare(b.horario.hora_inicio)),
    [clases, today]
  );

  const past = useMemo(
    () => clases
      .filter((c) => c.horario.fecha < today)
      .sort((a, b) => b.horario.fecha.localeCompare(a.horario.fecha)),
    [clases, today]
  );

  if (loading) {
    return (
      <div className="mt-[var(--space-lg)] flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mt-[var(--space-lg)] space-y-[var(--space-lg)]">
      {/* Upcoming */}
      <section>
        <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">{t('proximas_clases')}</h2>
        {upcoming.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarOff className="h-12 w-12 text-[var(--color-text-muted)] mb-3" />
            <p className="text-[var(--color-text-primary)] font-medium">{t('sin_proximas')}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((clase) => (
              <Link key={clase.id} href={`/alumno/horario?id=${clase.horario.id}`}>
                <Card hover>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{clase.horario.titulo}</p>
                    <StatusBadge status={clase.estado} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      <Calendar className="h-3 w-3 text-[var(--color-brand-gold)]" />
                      <span className="capitalize">{format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d" : "EEEE d 'de' MMMM", { locale: dateFnsLocale })}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      <Clock className="h-3 w-3 text-[var(--color-brand-gold)]" />
                      {clase.horario.hora_inicio} - {clase.horario.hora_fin}
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
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">{t('historial')}</h2>
          <div className="space-y-3">
            {past.map((clase) => (
              <Link key={clase.id} href={`/alumno/horario?id=${clase.horario.id}`}>
                <Card hover className="py-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{clase.horario.titulo}</p>
                    <StatusBadge status={clase.estado} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      <Calendar className="h-3 w-3 text-[var(--color-brand-gold)]" />
                      <span className="capitalize">{format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "MMMM d" : "d 'de' MMMM", { locale: dateFnsLocale })}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      <Clock className="h-3 w-3 text-[var(--color-brand-gold)]" />
                      {clase.horario.hora_inicio}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Detail view (?id= present) ── */
function HorarioDetailView({ clase, user, confirmar, cancelar, pedirCambio }: {
  clase: ClaseAlumno;
  user: { id: string } | null;
  confirmar: (id: string) => Promise<void>;
  cancelar: (id: string, nota?: string) => Promise<void>;
  pedirCambio: (id: string, nuevoId: string, nota?: string) => Promise<void>;
}) {
  const [modal, setModal] = useState<{ type: 'confirmar' | 'cancelar' | 'cambio'; clase: ClaseAlumno } | null>(null);
  const t = useTranslations('horarios');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  const borderColor = () => {
    switch (clase.estado) {
      case 'pendiente': return 'border-[var(--color-brand-gold)]';
      case 'confirmado': return 'border-[var(--color-success)]';
      case 'cancelado':
      case 'cambiado': return 'border-[var(--color-error)]';
      default: return 'border-[var(--color-border)]';
    }
  };

  return (
    <>
      <div className="mt-[var(--space-lg)] space-y-[var(--space-md)]">
        <Card className={`border-2 ${borderColor()}`} padding="lg">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{clase.horario.titulo}</h2>
              <StatusBadge status={clase.estado} />
            </div>

            {clase.horario.descripcion && (
              <p className="text-[var(--color-text-muted)]">{clase.horario.descripcion}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Calendar className="h-4 w-4 text-[var(--color-brand-gold)]" />
                <span className="capitalize">
                  {format(new Date(clase.horario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d yyyy" : "EEEE d 'de' MMMM yyyy", { locale: dateFnsLocale })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <Clock className="h-4 w-4 text-[var(--color-brand-gold)]" />
                <span>{clase.horario.hora_inicio} - {clase.horario.hora_fin}</span>
              </div>
            </div>

            {clase.horario.profesor && (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
                  {clase.horario.profesor.avatar_url ? (
                    <img src={clase.horario.profesor.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-[var(--color-brand-gold)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Prof. {clase.horario.profesor.nombre} {clase.horario.profesor.apellido}
                  </p>
                </div>
              </div>
            )}

            {clase.nota_alumno && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase mb-1">{t('tu_mensaje')}</p>
                <p className="text-sm text-[var(--color-text-primary)]">{clase.nota_alumno}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Acciones */}
        <Card padding="lg">
          <h3 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">{t('acciones')}</h3>

          {clase.estado === 'pendiente' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setModal({ type: 'confirmar', clase })}
                className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px]"
              >
                <CheckCircle className="h-5 w-5" />
                {t('confirmar_asistencia')}
              </button>
              <button
                onClick={() => setModal({ type: 'cancelar', clase })}
                className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px]"
              >
                <XCircle className="h-5 w-5" />
                {t('cancelar_asistencia')}
              </button>
            </div>
          )}

          {clase.estado === 'confirmado' && (
            <button
              onClick={() => setModal({ type: 'cancelar', clase })}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px] w-full sm:w-auto"
            >
              <XCircle className="h-4 w-4" />
              {t('cancelar_confirmado')}
            </button>
          )}

          {clase.estado === 'cancelado' && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-error)]">{t('cancelaste')}</p>
              <button
                onClick={() => setModal({ type: 'cambio', clase })}
                className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px] w-full sm:w-auto"
              >
                <ArrowRight className="h-4 w-4" />
                {t('pedir_otro_horario')}
              </button>
            </div>
          )}

          {clase.estado === 'cambiado' && (
            <p className="text-sm text-[var(--color-info)]">
              {t('esperando_cambio')}
            </p>
          )}
        </Card>
      </div>

      {/* Modales */}
      {modal?.type === 'confirmar' && (
        <ConfirmacionForm clase={modal.clase} onConfirm={confirmar} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'cancelar' && (
        <CancelacionForm clase={modal.clase} onCancel={cancelar} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'cambio' && user && (
        <CambioHorarioForm clase={modal.clase} alumnoId={user.id} onCambio={pedirCambio} onClose={() => setModal(null)} />
      )}
    </>
  );
}

/* ── Main page ── */
function AlumnoHorarioContent() {
  const { user } = useUserStore();
  const [horarioId] = useQueryParam('id');
  const { clases, loading, confirmar, cancelar, pedirCambio } = useAsistencia();
  const t = useTranslations('horarios');
  const tc = useTranslations('common');

  const clase = useMemo(
    () => (horarioId ? clases.find((c) => c.horario.id === horarioId) ?? null : null),
    [clases, horarioId]
  );

  // Loading state
  if (loading) {
    return (
      <div>
        <PageHeader title={t('mi_horario')} subtitle={horarioId ? t('detalle_clase') : t('todas_clases')} />
        <div className="mt-[var(--space-lg)] flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      </div>
    );
  }

  // No ?id= param → show list of all clases
  if (!horarioId) {
    return (
      <div>
        <PageHeader title={t('mi_horario')} subtitle={t('todas_clases')} />
        <HorarioListView clases={clases} loading={loading} />
      </div>
    );
  }

  // ?id= present but not found
  if (!clase) {
    return (
      <div>
        <PageHeader title={t('mi_horario')} subtitle={t('detalle_clase')} />
        <div className="mt-[var(--space-lg)]">
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[var(--color-text-primary)] font-medium">{t('clase_no_encontrada')}</p>
            <Link href="/alumno/horario" className="mt-3 text-sm text-[var(--color-brand-gold)] hover:underline flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> {t('volver_horario')}
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // Detail view
  return (
    <div>
      <PageHeader
        title={t('mi_horario')}
        subtitle={t('detalle_clase')}
        actions={
          <Link href="/alumno/horario" className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <ArrowLeft className="h-4 w-4" /> {tc('volver')}
          </Link>
        }
      />
      <HorarioDetailView clase={clase} user={user} confirmar={confirmar} cancelar={cancelar} pedirCambio={pedirCambio} />
    </div>
  );
}

export default function AlumnoHorarioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" /></div>}>
      <AlumnoHorarioContent />
    </Suspense>
  );
}
