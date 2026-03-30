'use client';

import { Suspense, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarOff, CheckCircle, XCircle, ArrowRight, Calendar, Clock } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmacionForm } from '@/components/horarios/ConfirmacionForm';
import { CancelacionForm } from '@/components/horarios/CancelacionForm';
import { CambioHorarioForm } from '@/components/horarios/CambioHorarioForm';
import { useAsistencia } from '@/lib/hooks/useAsistencia';
import { useUserStore } from '@/stores/useUserStore';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';
import Link from 'next/link';

function AlumnoDashboardContent() {
  const { user } = useUserStore();
  const { proximas, historial, proximaClase, loading, confirmar, cancelar, pedirCambio } = useAsistencia();
  const [modal, setModal] = useState<{ type: 'confirmar' | 'cancelar' | 'cambio'; clase: ClaseAlumno } | null>(null);

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
        <PageHeader title="Mis Clases" subtitle="Gestión de tu horario académico" />
        <div className="mt-[var(--space-lg)] flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Mis Clases"
        subtitle={user ? `${user.nombre} ${user.apellido}` : 'Gestión de tu horario académico'}
      />

      <div className="mt-[var(--space-lg)] space-y-[var(--space-lg)]">
        {/* Próxima clase destacada */}
        <section>
          <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">Próxima clase</h2>
          {proximaClase ? (
            <Card className={`border-2 ${borderColor(proximaClase.estado)}`} padding="lg">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {proximaClase.horario.titulo}
                    </p>
                    {proximaClase.horario.descripcion && (
                      <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{proximaClase.horario.descripcion}</p>
                    )}
                    {proximaClase.horario.profesor && (
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Prof. {proximaClase.horario.profesor.nombre} {proximaClase.horario.profesor.apellido}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={proximaClase.estado} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-primary)]">
                    <Calendar className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
                    <span className="capitalize">{format(new Date(proximaClase.horario.fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-primary)]">
                    <Clock className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
                    {proximaClase.horario.hora_inicio} - {proximaClase.horario.hora_fin}
                  </span>
                </div>

                {/* Acciones según estado */}
                {proximaClase.estado === 'pendiente' && (
                  <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <button
                      onClick={() => setModal({ type: 'confirmar', clase: proximaClase })}
                      className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px]"
                    >
                      <CheckCircle className="h-5 w-5" />
                      Confirmar asistencia
                    </button>
                    <button
                      onClick={() => setModal({ type: 'cancelar', clase: proximaClase })}
                      className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px]"
                    >
                      <XCircle className="h-5 w-5" />
                      No podré asistir
                    </button>
                  </div>
                )}

                {proximaClase.estado === 'confirmado' && (
                  <div className="mt-2">
                    <button
                      onClick={() => setModal({ type: 'cancelar', clase: proximaClase })}
                      className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[48px] w-full sm:w-auto"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar asistencia
                    </button>
                  </div>
                )}

                {proximaClase.estado === 'cancelado' && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-[var(--color-error)]">Cancelaste esta clase</p>
                    <button
                      onClick={() => setModal({ type: 'cambio', clase: proximaClase })}
                      className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 min-h-[48px] w-full sm:w-auto"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Pedir otro horario
                    </button>
                  </div>
                )}

                {proximaClase.estado === 'cambiado' && (
                  <p className="text-sm text-[var(--color-info)] mt-2">
                    Solicitaste cambio de horario — esperando aprobación del profesor.
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarOff className="h-12 w-12 text-[var(--color-text-muted)] mb-3" />
              <p className="text-[var(--color-text-primary)] font-medium">No tienes clases próximas</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Tu profesor te asignará nuevas clases pronto.</p>
            </Card>
          )}
        </section>

        {/* Próximas clases */}
        {proximas.length > 1 && (
          <section>
            <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">Próximas clases</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {proximas.slice(1).map((clase) => (
                <Link key={clase.id} href={`/alumno/horario?id=${clase.horario.id}`}>
                  <Card hover>
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{clase.horario.titulo}</p>
                      <StatusBadge status={clase.estado} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                        <Calendar className="h-3 w-3 text-[var(--color-brand-gold)]" />
                        <span className="capitalize">{format(new Date(clase.horario.fecha + 'T12:00:00'), "EEE d 'de' MMMM", { locale: es })}</span>
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
          </section>
        )}

        {/* Historial reciente */}
        {historial.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3">Historial reciente</h2>
            <div className="space-y-2">
              {historial.slice(0, 5).map((clase) => (
                <Card key={clase.id} className="py-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{clase.horario.titulo}</p>
                    <StatusBadge status={clase.estado} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      <Calendar className="h-3 w-3 text-[var(--color-brand-gold)]" />
                      <span className="capitalize">{format(new Date(clase.horario.fecha + 'T12:00:00'), "d 'de' MMMM", { locale: es })}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                      <Clock className="h-3 w-3 text-[var(--color-brand-gold)]" />
                      {clase.horario.hora_inicio}
                    </span>
                  </div>
                </Card>
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
      {modal?.type === 'cambio' && user && (
        <CambioHorarioForm clase={modal.clase} alumnoId={user.id} onCambio={pedirCambio} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

export default function AlumnoDashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" /></div>}>
      <AlumnoDashboardContent />
    </Suspense>
  );
}
