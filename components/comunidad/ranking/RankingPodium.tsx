'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { Crown, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RankMedal, type RankTier } from './RankMedal';
import type { RankingEntry } from '@/lib/comunidad/quiz';

type PodiumTier = Exclude<RankTier, 'none'>;

/** Visual order on screen: 2nd, 1st, 3rd. */
const SLOTS: { position: 1 | 2 | 3; tier: PodiumTier }[] = [
  { position: 2, tier: 'silver' },
  { position: 1, tier: 'gold' },
  { position: 3, tier: 'bronze' },
];

// Pedestal height per place (1st tallest).
const PEDESTAL: Record<PodiumTier, string> = {
  gold: 'h-32 sm:h-36',
  silver: 'h-24 sm:h-28',
  bronze: 'h-[4.5rem] sm:h-20',
};

// Entrance order: 3rd rises first, then 2nd, then the winner.
const DELAY: Record<PodiumTier, number> = { bronze: 0.05, silver: 0.15, gold: 0.28 };

/** First letter(s) of a name for the avatar disc. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Top 3 of the month as a podium (2nd · 1st · 3rd). Each place has an
 * initials avatar ringed in its metal, the medal, name, level and points on a
 * pedestal of matching height. Empty places show a dashed "open spot".
 * The caller's own place gets a "Tú" tag.
 */
export function RankingPodium({
  entries,
  currentUserId,
}: {
  entries: RankingEntry[];
  currentUserId?: string;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const byPosition = new Map(entries.filter((e) => e.position <= 3).map((e) => [e.position, e]));

  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {SLOTS.map(({ position, tier }) => {
        const entry = byPosition.get(position);
        const isGold = tier === 'gold';
        const isMe = !!entry && entry.user_id === currentUserId;
        const name = entry ? entry.display_name || entry.nickname || t('ranking_anonymous') : t('ranking_podium_free');
        const metal = `var(--game-rank-${tier})`;
        const metalLight = `var(--game-rank-${tier}-light)`;
        const metalDark = `var(--game-rank-${tier}-dark)`;

        return (
          <m.div
            key={position}
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: reduceMotion ? 0 : DELAY[tier], ease: [0.22, 1, 0.36, 1] }}
            className="flex min-w-0 flex-col items-center"
          >
            {/* Player */}
            <div className="relative mb-2 flex flex-col items-center">
              {isGold && entry && (
                <Crown
                  aria-hidden
                  className="game-anim-float absolute -top-6 size-6 fill-[var(--game-rank-gold)] text-[var(--game-rank-gold-dark)]"
                />
              )}
              <span
                className={cn(
                  'relative flex items-center justify-center rounded-full p-[3px]',
                  isGold ? 'size-[4.5rem] sm:size-20' : 'size-14 sm:size-16',
                  !entry && 'opacity-60'
                )}
                style={{
                  background: entry
                    ? `conic-gradient(from 210deg, ${metalLight}, ${metal}, ${metalDark}, ${metal}, ${metalLight})`
                    : 'var(--game-border)',
                  boxShadow: entry && isGold ? `0 10px 26px -12px ${metal}` : undefined,
                }}
              >
                <span
                  className={cn(
                    'flex size-full items-center justify-center rounded-full bg-[var(--game-surface)] font-extrabold',
                    isGold ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg',
                    !entry && 'border-2 border-dashed border-[var(--game-border)]'
                  )}
                  style={{ color: entry ? metalDark : 'var(--game-text-muted)' }}
                >
                  {entry ? initials(name) : <UserRound className="size-5" />}
                </span>
                {/* Medal pinned to the avatar */}
                <span className="absolute -bottom-2 -right-2">
                  <RankMedal position={position} size={isGold ? 34 : 28} />
                </span>
              </span>
            </div>

            <span
              className={cn(
                'mt-1 w-full truncate text-center font-bold',
                isGold ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
                entry ? 'text-[var(--game-text)]' : 'text-[var(--game-text-muted)]'
              )}
              title={entry ? name : undefined}
            >
              {name}
            </span>
            <div className="mb-2 mt-0.5 flex h-5 items-center gap-1">
              {entry?.level != null && (
                <span className="rounded-full bg-[var(--game-surface-muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--game-text-muted)]">
                  {t('ranking_level_short', { level: entry.level })}
                </span>
              )}
              {isMe && (
                <span className="rounded-full bg-[var(--game-accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--game-on-accent)]">
                  {t('ranking_you')}
                </span>
              )}
            </div>

            {/* Pedestal */}
            <div
              className={cn(
                'relative flex w-full flex-col items-center justify-start overflow-hidden rounded-t-[var(--game-radius)] pt-2.5',
                PEDESTAL[tier],
                isMe && 'ring-2 ring-[var(--game-accent)] ring-offset-2 ring-offset-[var(--game-surface)]'
              )}
              style={{
                background: entry
                  ? `linear-gradient(180deg, ${metal}, ${metalDark})`
                  : 'var(--game-surface-muted)',
              }}
            >
              {entry && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgba(255,255,255,0.35),transparent)]"
                />
              )}
              <span
                className={cn(
                  'relative font-extrabold tabular-nums',
                  isGold ? 'text-lg sm:text-xl' : 'text-sm sm:text-base',
                  entry ? 'text-white drop-shadow-sm' : 'text-[var(--game-text-muted)]'
                )}
              >
                {entry ? t('ranking_points', { points: entry.points }) : '—'}
              </span>
              <span
                aria-hidden
                className={cn(
                  'relative mt-auto pb-1 text-3xl font-black leading-none sm:text-4xl',
                  entry ? 'text-white/25' : 'text-[var(--game-border)]'
                )}
              >
                {position}
              </span>
            </div>
          </m.div>
        );
      })}
    </div>
  );
}
