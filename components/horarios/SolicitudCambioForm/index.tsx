'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send, X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useSolicitudesCambio } from '@/lib/hooks/useSolicitudesCambio';
import { useDisponibilidadProfesor } from '@/lib/hooks/useDisponibilidadProfesor';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SolicitudCambioFormProps {
  horarioOriginalId: string;
  profesorId: string;
  duracionMin: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Adds minutes to a time string (HH:mm) and returns the result as HH:mm.
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Returns today's date as YYYY-MM-DD string.
 */
function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns tomorrow's date as YYYY-MM-DD string (minimum selectable date).
 */
function getTomorrowISO(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SolicitudCambioForm({
  horarioOriginalId,
  profesorId,
  duracionMin,
  onSuccess,
  onCancel,
}: SolicitudCambioFormProps) {
  const t = useTranslations('cambioHorario.form');

  // Form state
  const [fechaPropuesta, setFechaPropuesta] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [notaAlumno, setNotaAlumno] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Auto-calculate end time
  const horaFin = useMemo(() => {
    if (!horaInicio) return '';
    return addMinutesToTime(horaInicio, duracionMin);
  }, [horaInicio, duracionMin]);

  // Availability check
  const { disponible, loading: checkingDisponibilidad } = useDisponibilidadProfesor({
    profesor_id: profesorId,
    fecha: fechaPropuesta || null,
    hora_inicio: horaInicio || null,
    hora_fin: horaFin || null,
  });

  // Solicitud mutation
  const { crearSolicitud, creating, createError } = useSolicitudesCambio();

  // Validation
  const isFechaValid = fechaPropuesta > getTodayISO();
  const isFormComplete = fechaPropuesta && horaInicio && horaFin && isFechaValid;
  const canSubmit = isFormComplete && disponible && !creating && !checkingDisponibilidad;

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]';

  // ─── Submit handler ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!canSubmit) return;

    try {
      await crearSolicitud({
        horario_original_id: horarioOriginalId,
        fecha_propuesta: fechaPropuesta,
        hora_inicio_propuesta: horaInicio,
        hora_fin_propuesta: horaFin,
        nota_alumno: notaAlumno || undefined,
      });
      toast.success(t('exito'));
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('duplicad') || message.includes('pendiente')) {
        toast.error(t('error_duplicado'));
      } else if (message.includes('disponible') || message.includes('409')) {
        toast.error(t('error_no_disponible'));
      } else {
        toast.error(t('error_generico'));
      }
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onCancel}
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
            {t('titulo')}
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
              aria-label={t('cancelar')}
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date picker */}
          <div>
            <label
              htmlFor="solicitud-fecha"
              className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
            >
              {t('fecha_label')}
            </label>
            <input
              id="solicitud-fecha"
              type="date"
              value={fechaPropuesta}
              min={getTomorrowISO()}
              onChange={(e) => setFechaPropuesta(e.target.value)}
              className={inputClass}
              required
            />
            {submitted && !fechaPropuesta && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{t('campo_requerido')}</p>
            )}
            {submitted && fechaPropuesta && !isFechaValid && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{t('fecha_futura')}</p>
            )}
          </div>

          {/* Time picker */}
          <div>
            <label
              htmlFor="solicitud-hora-inicio"
              className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
            >
              {t('hora_inicio_label')}
            </label>
            <input
              id="solicitud-hora-inicio"
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className={inputClass}
              required
            />
            {submitted && !horaInicio && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{t('campo_requerido')}</p>
            )}
          </div>

          {/* Auto-calculated end time (read-only display) */}
          <div>
            <label
              htmlFor="solicitud-hora-fin"
              className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
            >
              {t('hora_fin_label')}
            </label>
            <input
              id="solicitud-hora-fin"
              type="time"
              value={horaFin}
              readOnly
              className={`${inputClass} bg-[var(--color-bg-secondary)] cursor-not-allowed`}
              tabIndex={-1}
            />
            {horaFin && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {duracionMin} min
              </p>
            )}
          </div>

          {/* Availability feedback */}
          {fechaPropuesta && horaInicio && horaFin && (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
              {checkingDisponibilidad ? (
                <>
                  <Loader2 className="size-4 animate-spin text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {t('verificando')}
                  </span>
                </>
              ) : disponible ? (
                <>
                  <CheckCircle2 className="size-4 text-[var(--color-success)]" />
                  <span className="text-sm text-[var(--color-success)]">
                    {t('disponible')}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-[var(--color-error)]" />
                  <span className="text-sm text-[var(--color-error)]">
                    {t('no_disponible')}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Nota alumno (optional) */}
          <div>
            <label
              htmlFor="solicitud-nota"
              className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
            >
              {t('nota_label')}
            </label>
            <textarea
              id="solicitud-nota"
              value={notaAlumno}
              onChange={(e) => setNotaAlumno(e.target.value)}
              placeholder={t('nota_placeholder')}
              rows={3}
              className={inputClass}
            />
          </div>

          {/* Error from mutation */}
          {createError && (
            <p className="text-sm text-[var(--color-error)]">{t('error_generico')}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] min-h-[48px]"
              >
                {t('cancelar')}
              </button>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[48px]"
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('enviando')}
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  {t('enviar')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
