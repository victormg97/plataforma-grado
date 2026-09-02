'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/common/Card';
import type { PlayerLevel } from '@/lib/comunidad/game-config';

/**
 * Visual level card for the game side column. Shows the current level inside a
 * circular XP-progress ring and a labelled progress bar toward the next level.
 * When the player is at the max level, it shows a "max level" state instead.
 */
export function LevelCard({ level }: { level?: PlayerLevel | null }) {
  const t = useTranslations('comunidadEstrategica');

  const current = level?.level ?? 1;
  const xp = level?.xp ?? 0;
  const currentMin = level?.current_min ?? 0;
  const nextMin = level?.next_min ?? null;
  const isMax = nextMin === null;

  // Progress within the current level band [currentMin, nextMin].
  const span = isMax ? 0 : Math.max((nextMin as number) - currentMin, 1);
  const gained = Math.max(xp - currentMin, 0);
  const pct = isMax ? 100 : Math.min(Math.round((gained / span) * 100), 100);
  const remaining = isMax ? 0 : Math.max((nextMin as number) - xp, 0);

  // SVG ring geometry.
  const size = 60;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <Card
      padding="lg"
      className="flex items-center gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
    >
      {/* Circular progress ring with the level number in the center */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--game-accent-muted)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--game-gold)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="transition-[stroke-dasharray] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--game-text-muted)]">
            {t('level_label')}
          </span>
          <span className="text-lg font-bold text-[var(--game-gold)]">{current}</span>
        </div>
      </div>

      {/* Textual progress toward next level */}
      <div className="min-w-0 flex-1">
        {isMax ? (
          <p className="text-sm font-semibold text-[var(--game-gold)]">{t('level_max')}</p>
        ) : (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-[var(--game-text)]">
                {t('level_next', { level: current + 1 })}
              </span>
              <span className="text-[11px] tabular-nums text-[var(--game-text-muted)]">
                {xp} / {nextMin} XP
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--game-accent-muted)]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('level_progress_aria')}
            >
              <div
                className="h-full rounded-full bg-[var(--game-gold)] transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--game-text-muted)]">
              {t('level_xp_remaining', { xp: remaining })}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
