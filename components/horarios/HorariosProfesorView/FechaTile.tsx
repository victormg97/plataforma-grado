import { format } from 'date-fns';
import type { Locale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FechaTileProps {
  /** 'yyyy-MM-dd'. */
  fecha: string;
  dateFnsLocale: Locale;
  /** Accent tile (next class) or neutral tile (history). */
  destacada?: boolean;
}

/** Calendar-style date tile: weekday, big day number and month. */
export function FechaTile({ fecha, dateFnsLocale, destacada = false }: FechaTileProps) {
  const d = new Date(`${fecha}T12:00:00`);
  return (
    <div
      className={cn(
        'flex size-16 shrink-0 flex-col items-center justify-center rounded-[var(--radius-md)] border leading-none',
        destacada
          ? 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {format(d, 'EEE', { locale: dateFnsLocale })}
      </span>
      <span className="my-0.5 text-2xl font-bold">{format(d, 'd')}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
        {format(d, 'MMM', { locale: dateFnsLocale })}
      </span>
    </div>
  );
}
