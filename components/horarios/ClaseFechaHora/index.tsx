'use client';

import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';

interface ClaseFechaHoraProps {
  /** `YYYY-MM-DD` */
  fecha: string;
  /** `HH:mm` or `HH:mm:ss` */
  horaInicio: string;
  horaFin: string;
}

function toMinutes(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Date (weekday, day, month, year) and start/end time block for class detail modals. */
export function ClaseFechaHora({ fecha, horaInicio, horaFin }: ClaseFechaHoraProps) {
  const locale = useLocale();
  const t = useTranslations('horarios.fecha_hora');
  const isEn = locale === 'en';

  const fechaTexto = format(
    new Date(`${fecha}T12:00:00`),
    isEn ? 'EEEE, MMMM d, yyyy' : "EEEE d 'de' MMMM 'de' yyyy",
    { locale: isEn ? enUS : esDateFns },
  );

  const minutos = toMinutes(horaFin) - toMinutes(horaInicio);
  let duracion: string | null = null;
  if (minutos > 0) {
    const h = Math.floor(minutos / 60);
    const min = minutos % 60;
    if (h === 0) duracion = t('duracion_min', { min });
    else if (min === 0) duracion = t('duracion_h', { h });
    else duracion = t('duracion_h_min', { h, min });
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
          <Calendar className="size-4" style={{ color: 'var(--color-brand-gold)' }} />
        </span>
        <p className="text-sm font-medium capitalize leading-snug text-[var(--color-text-primary)]">
          {fechaTexto}
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
          <Clock className="size-4" style={{ color: 'var(--color-brand-gold)' }} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium tabular-nums text-[var(--color-text-primary)]">
            {horaInicio.slice(0, 5)} – {horaFin.slice(0, 5)}
          </p>
          {duracion && (
            <p className="text-xs text-[var(--color-text-muted)]">{duracion}</p>
          )}
        </div>
      </div>
    </div>
  );
}
