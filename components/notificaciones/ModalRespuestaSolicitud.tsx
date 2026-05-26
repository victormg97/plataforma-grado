'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { X, Check, XCircle, Loader2, Calendar, Clock, User, MessageSquare } from 'lucide-react';
import { useSolicitudesCambio, type SolicitudCambio } from '@/lib/hooks/useSolicitudesCambio';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalRespuestaSolicitudProps {
  solicitud: SolicitudCambio;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModalRespuestaSolicitud({
  solicitud,
  onClose,
}: ModalRespuestaSolicitudProps) {
  const t = useTranslations('cambioHorario.modal');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const { aceptarSolicitud, rechazarSolicitud, responding } = useSolicitudesCambio({
    enabled: false,
  });

  const [showRechazoForm, setShowRechazoForm] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Formats a date string (YYYY-MM-DD) into written + numeric format */
  const formatFechaCompleta = (fechaStr: string) => {
    const date = new Date(`${fechaStr}T12:00:00`);
    const written = format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: dateFnsLocale });
    const [y, m, d] = fechaStr.split('-');
    const numeric = `${d}-${m}-${y}`;
    return { written: written.charAt(0).toUpperCase() + written.slice(1), numeric };
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

  const alumnoNombre = solicitud.alumno
    ? `${solicitud.alumno.nombre} ${solicitud.alumno.apellido}`
    : '—';

  const claseOriginal = solicitud.horario_original;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAceptar = async () => {
    try {
      await aceptarSolicitud(solicitud.id);
      toast.success(t('exito_aceptada'));
      onClose();
    } catch {
      toast.error(t('error_aceptar'));
    }
  };

  const handleRechazar = async () => {
    try {
      await rechazarSolicitud(solicitud.id, motivoRechazo || undefined);
      toast.success(t('exito_rechazada'));
      onClose();
    } catch {
      toast.error(t('error_rechazar'));
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────────────

  const infoCardClass =
    'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3';

  const labelClass = 'text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-lg)] shadow-[var(--shadow-lg)]"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t('titulo_respuesta')}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Alumno */}
          <div className={infoCardClass}>
            <div className="flex items-center gap-2 mb-1">
              <User className="size-3.5 text-[var(--color-brand-gold)]" />
              <span className={labelClass}>{t('alumno')}</span>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {alumnoNombre}
            </p>
          </div>

          {/* Clase original */}
          {claseOriginal && (
            <div className={infoCardClass}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="size-3.5 text-[var(--color-brand-gold)]" />
                <span className={labelClass}>{t('clase_original')}</span>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {claseOriginal.titulo || '—'}
              </p>
              {(() => {
                const { written, numeric } = formatFechaCompleta(claseOriginal.fecha);
                return (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-sm text-[var(--color-text-primary)]">{written}</p>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {numeric}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {claseOriginal.hora_inicio?.slice(0, 5)} - {claseOriginal.hora_fin?.slice(0, 5)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Horario propuesto */}
          <div className={infoCardClass}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="size-3.5 text-[var(--color-brand-gold)]" />
              <span className={labelClass}>{t('horario_propuesto')}</span>
            </div>
            {(() => {
              const { written, numeric } = formatFechaCompleta(solicitud.fecha_propuesta);
              return (
                <div className="space-y-0.5">
                  <p className="text-sm text-[var(--color-text-primary)]">{written}</p>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {numeric}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {solicitud.hora_inicio_propuesta?.slice(0, 5)} - {solicitud.hora_fin_propuesta?.slice(0, 5)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Nota del alumno */}
          {solicitud.nota_alumno && (
            <div className={infoCardClass}>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="size-3.5 text-[var(--color-brand-gold)]" />
                <span className={labelClass}>Nota del alumno</span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] italic">
                &ldquo;{solicitud.nota_alumno}&rdquo;
              </p>
            </div>
          )}

          {/* Rechazo form */}
          {showRechazoForm && (
            <div className="space-y-2">
              <label
                htmlFor="motivo-rechazo"
                className="block text-sm font-medium text-[var(--color-text-primary)]"
              >
                {t('motivo_rechazo_label')}
              </label>
              <textarea
                id="motivo-rechazo"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                placeholder={t('motivo_rechazo_placeholder')}
                rows={3}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {!showRechazoForm ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowRechazoForm(true)}
                  disabled={responding}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 disabled:opacity-50 min-h-[48px] dark:hover:bg-red-950/20"
                >
                  <XCircle className="size-4" />
                  {t('rechazar')}
                </button>
                <button
                  type="button"
                  onClick={handleAceptar}
                  disabled={responding}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[48px]"
                >
                  {responding ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('aceptando')}
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      {t('aceptar')}
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowRechazoForm(false)}
                  disabled={responding}
                  className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 min-h-[48px]"
                >
                  {t('cancelar')}
                </button>
                <button
                  type="button"
                  onClick={handleRechazar}
                  disabled={responding}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-error)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[48px]"
                >
                  {responding ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('rechazando')}
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4" />
                      {t('confirmar_rechazo')}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
