'use client';

import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { X, Calendar, Clock, MessageSquare, XCircle } from 'lucide-react';
import { type SolicitudCambio } from '@/lib/hooks/useSolicitudesCambio';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalRechazoDetalleProps {
  solicitud: SolicitudCambio;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModalRechazoDetalle({
  solicitud,
  onClose,
}: ModalRechazoDetalleProps) {
  const t = useTranslations('cambioHorario.modal');
  const tEstado = useTranslations('cambioHorario.estado');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatFechaCompleta = (fechaStr: string) => {
    const date = new Date(`${fechaStr}T12:00:00`);
    const written = format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: dateFnsLocale });
    const [y, m, d] = fechaStr.split('-');
    const numeric = `${d}-${m}-${y}`;
    return { written: written.charAt(0).toUpperCase() + written.slice(1), numeric };
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

  const claseOriginal = solicitud.horario_original;

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
            {t('titulo_rechazo_detalle')}
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
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
              <XCircle className="size-3" />
              {tEstado('rechazada')}
            </span>
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

          {/* Horario propuesto (rechazado) */}
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

          {/* Motivo de rechazo */}
          <div className={infoCardClass}>
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="size-3.5 text-[var(--color-brand-gold)]" />
              <span className={labelClass}>{t('motivo_rechazo_label')}</span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] italic">
              {solicitud.motivo_rechazo
                ? `\u201C${solicitud.motivo_rechazo}\u201D`
                : 'No se proporcionó motivo'}
            </p>
          </div>

          {/* Close button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] min-h-[48px]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
