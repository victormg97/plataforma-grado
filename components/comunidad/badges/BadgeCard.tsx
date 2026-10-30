'use client';

/* eslint-disable @next/next/no-img-element -- small public storage images */
import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { Award, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UnlockedBadge, LockedBadge, BadgeCriteria } from '@/lib/comunidad/badge';
import { badgeImageUrl } from './badgeImageUrl';

// Badges granted within this window get a "Nueva" tag.
const NEW_BADGE_MS = 3 * 24 * 60 * 60 * 1000;

export function criteriaLabel(
  criteria: BadgeCriteria | null,
  t: ReturnType<typeof useTranslations>
): string | null {
  if (!criteria) return null;
  switch (criteria.type) {
    case 'streak_reached':
      return t('badge_criteria_streak', { days: criteria.days });
    case 'quiz_completed_count':
      return t('badge_criteria_quiz', { count: criteria.count });
    case 'weekly_case_count':
      return t('badge_criteria_weekly_case', { count: criteria.count });
    case 'interrogacion_count':
      return t('badge_criteria_interrogacion', { count: criteria.count });
    case 'subject_max_score':
      return t('badge_criteria_subject_score', { score: criteria.score });
    case 'challenges_completed':
      return t('badge_criteria_challenges', { count: criteria.count });
    default:
      return null;
  }
}

export function isNewBadge(badge: UnlockedBadge | LockedBadge, now: number): boolean {
  return 'granted_at' in badge && now - new Date(badge.granted_at).getTime() < NEW_BADGE_MS;
}

/**
 * Medallion: gold rim + inner disc with the badge image. Locked badges are a
 * gray silhouette with a dashed rim and a lock. Sizes: md (grid) / lg (modal).
 */
export function BadgeMedallion({
  badge,
  locked,
  size = 'md',
}: {
  badge: UnlockedBadge | LockedBadge;
  locked: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const imageUrl = badgeImageUrl(badge.image_path);
  const box = size === 'lg' ? 'size-36' : size === 'sm' ? 'size-16' : 'size-24';
  const icon = size === 'lg' ? 'size-16' : size === 'sm' ? 'size-7' : 'size-10';

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full p-[4px]',
        box,
        locked
          ? 'border-2 border-dashed border-[var(--game-border)] bg-[var(--game-surface-muted)]'
          : 'bg-[conic-gradient(from_200deg,var(--game-rank-gold-light),var(--game-rank-gold),var(--game-rank-gold-dark),var(--game-rank-gold),var(--game-rank-gold-light))] shadow-[0_10px_24px_-12px_var(--game-rank-gold)]'
      )}
    >
      <span
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden rounded-full',
          locked ? 'bg-[var(--game-surface)]' : 'bg-[radial-gradient(circle_at_35%_30%,var(--game-surface),var(--game-rank-gold-bg))]'
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className={cn('size-[78%] object-contain', locked && 'opacity-40 grayscale')}
            loading="lazy"
          />
        ) : (
          <Award className={cn(icon, locked ? 'text-[var(--game-text-muted)] opacity-50' : 'text-[var(--game-rank-gold-dark)]')} />
        )}
        {/* Shine sweep on hover (unlocked only) */}
        {!locked && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg] bg-white/40 transition-all duration-700 group-hover:left-[150%] motion-reduce:hidden"
          />
        )}
      </span>
      {locked && (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-[var(--game-surface)] text-[var(--game-text-muted)] shadow ring-1 ring-[var(--game-border)]">
          <Lock className="size-3.5" />
        </span>
      )}
    </span>
  );
}

interface BadgeCardProps {
  badge: UnlockedBadge | LockedBadge;
  locked?: boolean;
  isNew?: boolean;
  index?: number;
  onOpen?: () => void;
}

/** Clickable badge tile for the showcase grid (opens the detail modal). */
export function BadgeCard({ badge, locked = false, isNew = false, index = 0, onOpen }: BadgeCardProps) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const criteria = locked ? criteriaLabel((badge as LockedBadge).criteria, t) : null;

  return (
    <m.button
      type="button"
      onClick={onOpen}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: reduceMotion ? 0 : Math.min(index, 16) * 0.035 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      className={cn(
        'group relative flex flex-col items-center gap-3 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 text-center shadow-[var(--game-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-rank-gold)]',
        locked && 'bg-[var(--game-surface)]/70'
      )}
    >
      {isNew && (
        <span className="absolute right-3 top-3 rounded-full bg-[var(--game-accent)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--game-on-accent)] motion-safe:animate-pulse">
          {t('badge_new')}
        </span>
      )}
      <span className={cn('transition-transform duration-300', !locked && 'group-hover:rotate-[-6deg] group-hover:scale-105')}>
        <BadgeMedallion badge={badge} locked={locked} />
      </span>
      <div className="min-w-0">
        <div className={cn('line-clamp-2 text-sm font-bold', locked ? 'text-[var(--game-text-muted)]' : 'text-[var(--game-text)]')}>
          {badge.name}
        </div>
        {locked ? (
          <p className="mt-1 line-clamp-2 text-[11px] font-medium text-[var(--game-accent)]">
            {criteria ?? ((badge as LockedBadge).hide_criteria ? t('badge_criteria_hidden') : '')}
          </p>
        ) : (
          badge.description && (
            <p className="mt-1 line-clamp-2 text-xs text-[var(--game-text-muted)]">{badge.description}</p>
          )
        )}
      </div>
    </m.button>
  );
}
