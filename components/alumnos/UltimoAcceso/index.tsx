'use client';

/**
 * Last access of a user as a small tile: a coloured dot (live pulse when it was today),
 * a short human text and the exact date in a tooltip.
 *   today -> "Activo hoy" (green, pulsing) | <7 days -> "hace 2 días" | otherwise a short date.
 *   null  -> "Aún no ingresa" (muted)
 */

import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Tooltip } from '@/components/common/Tooltip';
import { cn } from '@/lib/utils';

interface UltimoAccesoProps {
  dateStr?: string | null;
  className?: string;
}

type Tono = 'reciente' | 'medio' | 'antiguo' | 'nunca';

const TONO_PUNTO: Record<Tono, string> = {
  reciente: 'bg-[var(--color-success)]',
  medio: 'bg-[var(--color-warning)]',
  antiguo: 'bg-[var(--color-text-muted)]/60',
  nunca: 'bg-[var(--color-border-strong,var(--color-border))]',
};

const TONO_FONDO: Record<Tono, string> = {
  reciente: 'bg-[var(--color-success)]/15',
  medio: 'bg-[var(--color-warning)]/15',
  antiguo: 'bg-[var(--color-text-muted)]/15',
  nunca: 'bg-[var(--color-text-muted)]/10',
};

const TONO_ICONO: Record<Tono, string> = {
  reciente: 'text-[var(--color-success)]',
  medio: 'text-[var(--color-warning)]',
  antiguo: 'text-[var(--color-text-muted)]',
  nunca: 'text-[var(--color-text-muted)]',
};

export function UltimoAcceso({ dateStr, className }: UltimoAccesoProps) {
  const t = useTranslations('alumnos');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  let texto: string;
  let tono: Tono;
  let tooltip: string;
  let enVivo = false;

  if (!dateStr) {
    texto = t('nunca_ingreso');
    tono = 'nunca';
    tooltip = t('nunca_ingreso');
  } else {
    const fecha = new Date(dateStr);
    const dias = differenceInDays(new Date(), fecha);
    if (dias < 1) {
      texto = t('acceso_hoy');
      enVivo = true;
    } else if (dias < 7) {
      texto = formatDistanceToNow(fecha, { addSuffix: true, locale: dateFnsLocale });
    } else {
      texto = format(fecha, locale === 'en' ? 'MMM d, yyyy' : "d MMM yyyy", { locale: dateFnsLocale });
    }
    tono = dias <= 3 ? 'reciente' : dias <= 30 ? 'medio' : 'antiguo';
    tooltip = format(
      fecha,
      locale === 'en' ? "EEEE, MMMM d yyyy 'at' HH:mm" : "EEEE d 'de' MMMM yyyy, HH:mm",
      { locale: dateFnsLocale },
    );
  }

  return (
    <Tooltip content={tooltip} position="top" className="w-full">
      <div
        className={cn(
          'flex w-full min-w-0 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3.5 py-2.5 text-left',
          className,
        )}
      >
        <span
          className={cn(
            'relative flex size-9 shrink-0 items-center justify-center rounded-full',
            TONO_FONDO[tono],
          )}
          aria-hidden="true"
        >
          {enVivo && (
            <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-30', TONO_PUNTO[tono])} />
          )}
          <Clock className={cn('relative size-4.5', TONO_ICONO[tono])} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('acceso_etiqueta')}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)] first-letter:uppercase">
            {texto}
          </span>
        </span>
      </div>
    </Tooltip>
  );
}