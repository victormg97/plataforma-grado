'use client';

import { useTranslations } from 'next-intl';
import { Hourglass, Radio } from 'lucide-react';
import { useClaseCountdown } from '@/lib/hooks/useClaseCountdown';

interface ClaseCountdownProps {
  /** `YYYY-MM-DD` */
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/** Live "time until the class starts" banner, driven by the server clock (Chile). */
export function ClaseCountdown({ fecha, horaInicio, horaFin }: ClaseCountdownProps) {
  const t = useTranslations('horarios.countdown');
  const { phase, remainingMs } = useClaseCountdown(fecha, horaInicio, horaFin);

  if (phase === 'loading' || phase === 'ended') return null;

  const { d, h, m, s } = split(remainingMs);
  const live = phase === 'live';
  const soon = !live && remainingMs < 3600_000;

  const segments: Array<{ value: number; label: string }> = [];
  if (d > 0) segments.push({ value: d, label: t('dias', { count: d }) });
  if (d > 0 || h > 0) segments.push({ value: h, label: t('horas', { count: h }) });
  segments.push({ value: m, label: t('min') });
  if (d === 0) segments.push({ value: s, label: t('seg') });

  const tone = live
    ? 'border-[color-mix(in_srgb,var(--color-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success-fg)]'
    : soon
      ? 'border-[color-mix(in_srgb,var(--color-partial)_55%,transparent)] bg-[var(--color-partial-muted)] text-[var(--color-partial)]'
      : 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]';

  const Icon = live ? Radio : Hourglass;
  const spoken = live
    ? t('aria_en_curso')
    : t('aria_faltan', { d, h, m, s });

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-lg)] border px-4 py-3 ${tone}`}
      role="timer"
      aria-label={spoken}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-8 items-center justify-center rounded-full bg-current/15">
          <Icon className="size-4" />
          {live && <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-[var(--color-success-fg)]" />}
        </span>
        <p className="text-sm font-semibold">{live ? t('en_curso') : t('comienza_en')}</p>
      </div>
      <div className="flex items-end gap-2" aria-hidden="true">
        {segments.map((seg) => (
          <div key={seg.label} className="min-w-12 rounded-[var(--radius-md)] bg-[var(--color-bg)] px-2 py-1 text-center shadow-[var(--shadow-sm)]">
            <p className="text-lg font-semibold leading-none tabular-nums text-[var(--color-text-primary)]">
              {String(seg.value).padStart(2, '0')}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">{seg.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
