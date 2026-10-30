'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export type RankTier = 'gold' | 'silver' | 'bronze' | 'none';

export function rankTier(position: number): RankTier {
  if (position === 1) return 'gold';
  if (position === 2) return 'silver';
  if (position === 3) return 'bronze';
  return 'none';
}

// Sparkles around the 1st-place medal (position % of the box, size px, delay s).
const SPARKLES = [
  { top: '2%', left: '4%', size: 7, delay: 0 },
  { top: '18%', left: '84%', size: 6, delay: 0.6 },
  { top: '72%', left: '90%', size: 5, delay: 1.1 },
  { top: '80%', left: '-4%', size: 5, delay: 1.5 },
];

/**
 * Podium medal with a ribbon for positions 1–3 (gold / silver / bronze).
 * The gold one swings on its ribbon, has a shine sweep and twinkling
 * sparkles (CSS transform/opacity only; disabled with reduced motion).
 * Positions 4+ render a plain numbered disc.
 */
export function RankMedal({ position, size = 40 }: { position: number; size?: number }) {
  const tier = rankTier(position);
  const uid = useId().replace(/:/g, '');

  if (tier === 'none') {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-[var(--game-surface-muted)] text-sm font-bold text-[var(--game-text-muted)]"
        style={{ width: size * 0.8, height: size * 0.8, marginInline: size * 0.1 }}
      >
        {position}
      </span>
    );
  }

  const isGold = tier === 'gold';
  const c = `var(--game-rank-${tier})`;
  const light = `var(--game-rank-${tier}-light)`;
  const dark = `var(--game-rank-${tier}-dark)`;

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className={cn('inline-flex size-full', isGold && 'game-anim-medal-swing')}>
        <svg viewBox="0 0 40 40" className="size-full overflow-visible">
          <defs>
            <radialGradient id={`medal-${uid}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" style={{ stopColor: light }} />
              <stop offset="55%" style={{ stopColor: c }} />
              <stop offset="100%" style={{ stopColor: dark }} />
            </radialGradient>
            <clipPath id={`medal-clip-${uid}`}>
              <circle cx="20" cy="24" r="12" />
            </clipPath>
          </defs>

          {/* Ribbon */}
          <path d="M12 2 L18 2 L22 14 L16 15 Z" style={{ fill: 'var(--game-rank-ribbon-a)' }} />
          <path d="M28 2 L22 2 L18 14 L24 15 Z" style={{ fill: 'var(--game-rank-ribbon-b)' }} />

          {/* Disc */}
          <circle cx="20" cy="24" r="12" style={{ fill: `url(#medal-${uid})`, stroke: dark }} strokeWidth="1.2" />
          <circle cx="20" cy="24" r="9" fill="none" style={{ stroke: light }} strokeWidth="0.8" opacity="0.8" />

          {/* Shine sweep (gold only) */}
          {isGold && (
            <g clipPath={`url(#medal-clip-${uid})`}>
              <rect x="17" y="8" width="5" height="32" fill="white" opacity="0.55" className="game-anim-medal-shine" />
            </g>
          )}

          <text
            x="20"
            y="28.2"
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            style={{ fill: dark }}
          >
            {position}
          </text>
        </svg>
      </span>

      {isGold &&
        SPARKLES.map((s, i) => (
          <span
            key={i}
            className="game-anim-sparkle pointer-events-none absolute"
            style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
          >
            <svg viewBox="0 0 10 10" className="size-full">
              <path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" style={{ fill: light }} />
            </svg>
          </span>
        ))}
    </span>
  );
}
