'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { CalendarDays, CalendarRange, CheckCircle2, Clock, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { quizToneStyle } from '../quiz/QuizItemIcon';
import { ChallengeProgressBar } from './ChallengeProgressBar';
import type { ActiveChallenge } from '@/lib/comunidad/quiz';

// Each period type has its own look (tone + icon).
const PERIOD_LOOK = {
  weekly: { tone: 'sky', Icon: CalendarDays },
  monthly: { tone: 'violet', Icon: CalendarRange },
  custom: { tone: 'amber', Icon: Target },
} as const;

/** "Quedan 3 días" / "Quedan 5 h" / "Termina pronto" from the period end. */
function useTimeLeft(endIso?: string): string | null {
  const t = useTranslations('comunidadEstrategica');
  // Captured once per mount (render must stay pure); hour precision is enough.
  const [now] = useState(() => Date.now());
  if (!endIso) return null;
  const ms = new Date(endIso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return t('challenge_left_days', { count: Math.floor(hours / 24) });
  if (hours >= 1) return t('challenge_left_hours', { count: hours });
  return t('challenge_left_soon');
}

/**
 * Quest card for an active challenge: period-colored medallion, title,
 * description, segmented progress and time left. Completed challenges turn
 * gold with a trophy seal.
 */
export function ChallengeCard({ challenge, index = 0 }: { challenge: ActiveChallenge; index?: number }) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const look = PERIOD_LOOK[challenge.period_type] ?? PERIOD_LOOK.custom;
  const timeLeft = useTimeLeft(challenge.period_end);
  const done = challenge.completed;
  const target = Math.max(challenge.target_count, 1);
  const progress = Math.min(challenge.progress_count, target);
  const pct = Math.round((progress / target) * 100);
  const Icon = done ? Trophy : look.Icon;

  return (
    <m.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: reduceMotion ? 0 : Math.min(index, 10) * 0.06, ease: 'easeOut' }}
      style={quizToneStyle(look.tone)}
      className={cn(
        'relative isolate flex flex-col gap-4 overflow-hidden rounded-[var(--game-radius)] border-2 bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]',
        done ? 'border-[var(--game-rank-gold)]' : 'border-transparent'
      )}
    >
      {/* Tinted corner glow */}
      <span
        aria-hidden
        className={cn(
          'absolute -right-16 -top-16 -z-10 size-44 rounded-full blur-2xl',
          done ? 'bg-[var(--game-rank-gold-bg)]' : 'bg-[var(--tone-soft)]'
        )}
      />

      {done && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,var(--game-rank-gold-light),var(--game-rank-gold))] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[var(--game-rank-gold-dark)] shadow-sm">
          <CheckCircle2 className="size-3.5" />
          {t('challenge_completed')}
        </span>
      )}

      <div className="flex items-start gap-4">
        <span
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_20px_-12px_var(--tone)]',
            done
              ? 'bg-[linear-gradient(135deg,var(--game-rank-gold-light),var(--game-rank-gold))] text-[var(--game-rank-gold-dark)]'
              : 'bg-[linear-gradient(135deg,var(--tone),var(--tone-deep))]'
          )}
        >
          <Icon className="size-7" />
        </span>
        <div className={cn('min-w-0 flex-1', done && 'pr-24')}>
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              done ? 'bg-[var(--game-rank-gold-bg)] text-[var(--game-rank-gold-dark)]' : 'bg-[var(--tone-soft)] text-[var(--tone)]'
            )}
          >
            {t(`challenge_period_${challenge.period_type}`)}
          </span>
          <h3 className="mt-1 text-base font-bold leading-snug text-[var(--game-text)]">{challenge.title}</h3>
          {challenge.description && (
            <p className="mt-0.5 text-sm text-[var(--game-text-muted)]">{challenge.description}</p>
          )}
        </div>
      </div>

      <ChallengeProgressBar progress={challenge.progress_count} target={challenge.target_count} completed={done} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums text-[var(--game-text)]">
          {t('challenge_progress', { progress, target: challenge.target_count })}
          <span className="ml-1.5 font-medium text-[var(--game-text-muted)]">· {pct}%</span>
        </span>
        {!done && timeLeft && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--game-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--game-text-muted)]">
            <Clock className="size-3.5" />
            {timeLeft}
          </span>
        )}
      </div>
    </m.article>
  );
}
