'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Award, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UnlockedBadge, LockedBadge, BadgeCriteria } from '@/lib/comunidad/badge';
import { badgeImageUrl } from './badgeImageUrl';

function criteriaLabel(
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

interface BadgeCardProps {
  badge: UnlockedBadge | LockedBadge;
  locked?: boolean;
}

/**
 * A circular medallion badge (styled after the mockups). Unlocked badges are
 * full color; locked badges are dimmed with a lock overlay (Req. 7.3). Locked
 * badges show their criteria unless hidden (Req. 7.4/7.5).
 */
export function BadgeCard({ badge, locked = false }: BadgeCardProps) {
  const t = useTranslations('comunidadEstrategica');
  const imageUrl = badgeImageUrl(badge.image_path);

  const criteria = locked ? criteriaLabel((badge as LockedBadge).criteria, t) : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 text-center shadow-[var(--game-shadow)]',
        locked && 'opacity-70'
      )}
    >
      <div
        className={cn(
          'relative flex size-20 items-center justify-center rounded-full',
          locked
            ? 'bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]'
            : 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={badge.name}
            width={80}
            height={80}
            className={cn('size-16 rounded-full object-contain', locked && 'grayscale')}
          />
        ) : (
          <Award className="size-9" />
        )}
        {locked && (
          <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[var(--game-surface)] text-[var(--game-text-muted)] shadow">
            <Lock className="size-3.5" />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate font-semibold text-[var(--game-text)]">{badge.name}</div>
        {badge.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--game-text-muted)]">
            {badge.description}
          </p>
        )}
        {locked && criteria && (
          <p className="mt-1 text-[11px] font-medium text-[var(--game-accent)]">{criteria}</p>
        )}
        {locked && !criteria && (badge as LockedBadge).hide_criteria && (
          <p className="mt-1 text-[11px] italic text-[var(--game-text-muted)]">
            {t('badge_criteria_hidden')}
          </p>
        )}
      </div>
    </div>
  );
}
