'use client';

import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';
import { Timer } from 'lucide-react';

interface ClaseFechaHoraHeroProps {
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

/** Calendar-tile style date plus start → end timeline, for the full class detail page. */
export function ClaseFechaHoraHero({ fecha, horaInicio, horaFin }: ClaseFechaHoraHeroProps) {
  const locale = useLocale();
  const t = useTranslations('horarios.fecha_hora');
  const isEn = locale === 'en';
  const opts = { locale: isEn ? enUS : esDateFns };
  const date = new Date(`${fecha}T12:00:00`);

  const weekday = format(date, 'EEEE', opts);
  const day = format(date, 'd', opts);
  const monthShort = format(date, 'MMM', opts).replace('.', '');
  const fullDate = format(date, isEn ? 'MMMM d, yyyy' : "d 'de' MMMM 'de' yyyy", opts);

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
    <div className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Date */}
      <div className="flex items-center gap-4 bg-[var(--color-bg-secondary)] p-4">
        <div
          className="flex w-16 shrink-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-center shadow-[var(--shadow-sm)]"
          aria-hidden="true"
        >
          <span className="bg-[var(--color-brand-gold)] py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            {monthShort}
          </span>
          <span className="py-1 text-2xl font-semibold leading-none tabular-nums text-[var(--color-text-primary)]">
            {day}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('fecha')}</p>
          <p className="text-lg font-semibold capitalize leading-tight text-[var(--color-text-primary)]">{weekday}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{fullDate}</p>
        </div>
      </div>

      {/* Time */}
      <div className="flex flex-col justify-center gap-3 bg-[var(--color-bg-secondary)] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('horario')}</p>
          {duracion && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
              <Timer className="size-3" />
              {duracion}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-2xl font-semibold leading-none tabular-nums text-[var(--color-text-primary)]">{horaInicio.slice(0, 5)}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('inicio')}</p>
          </div>
          <div className="flex min-w-6 flex-1 items-center" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-[var(--color-brand-gold)]" />
            <span className="h-px flex-1 bg-[var(--color-border-strong)]" />
            <span className="size-1.5 rounded-full border border-[var(--color-brand-gold)]" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold leading-none tabular-nums text-[var(--color-text-primary)]">{horaFin.slice(0, 5)}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('fin')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
