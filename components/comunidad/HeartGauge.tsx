'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, m, useAnimationControls, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// lucide "heart" outline, used as a filled shape.
const HEART =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

// Zig-zag fracture line, top notch → bottom tip. Both halves share it.
const CRACK = '12,5.2 10.6,8.6 13.2,11.2 11,14.4 12.6,17.4 12,20.6';
const CRACK_BRANCH = '13.2,11.2 15.8,10.2 16.9,11.8';
const LEFT_CLIP = `0,0 12,0 ${CRACK} 12,24 0,24`;
const RIGHT_CLIP = `12,0 24,0 24,24 12,24 ${CRACK.split(' ').reverse().join(' ')}`;

// Shards thrown when a life is lost (angle deg, distance px, rotation deg).
const SHARDS = [
  { deg: -140, dist: 15, rot: -120 },
  { deg: -60, dist: 17, rot: 140 },
  { deg: -15, dist: 13, rot: -90 },
  { deg: 200, dist: 14, rot: 100 },
  { deg: 30, dist: 12, rot: 160 },
];

export type HeartStage = 'full' | 'cracked' | 'critical' | 'broken';

export function heartStage(current: number, max: number): HeartStage {
  if (current <= 0) return 'broken';
  const ratio = max > 0 ? current / max : 1;
  if (ratio >= 0.67) return 'full';
  if (ratio > 0.34) return 'cracked';
  return 'critical';
}

/**
 * Animated SVG heart that degrades with the remaining lives:
 *  - full:     glossy heart with a calm heartbeat.
 *  - cracked:  a fracture runs halfway down the heart.
 *  - critical: the fracture is complete, it beats fast and glows red.
 *  - broken:   the heart splits into two gray halves.
 * On each lost life it shakes, flashes and throws shards; on a gained life it
 * pops with a sparkle ring (and the halves snap back together from broken).
 */
export function HeartGauge({ current, max }: { current: number; max: number }) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const body = useAnimationControls();
  const prevRef = useRef(current);
  const [burst, setBurst] = useState<{ key: number; kind: 'loss' | 'gain' } | null>(null);

  const stage = heartStage(current, max);
  const broken = stage === 'broken';

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = current;
    if (current === prev || reduceMotion) return;

    if (current < prev) {
      setBurst({ key: Date.now(), kind: 'loss' }); // eslint-disable-line react-hooks/set-state-in-effect
      void body.start({
        x: [0, -3, 3, -2.5, 2, -1, 0],
        rotate: [0, -10, 9, -6, 4, 0, 0],
        scale: [1, 0.82, 1.08, 0.96, 1.02, 1, 1],
        transition: { duration: 0.55, ease: 'easeInOut' },
      });
    } else {
      setBurst({ key: Date.now(), kind: 'gain' });
      void body.start({
        scale: [1, 1.35, 0.92, 1.06, 1],
        transition: { duration: 0.55, ease: 'easeOut' },
      });
    }
  }, [current, body, reduceMotion]);

  const crackLength = stage === 'cracked' ? 0.5 : stage === 'critical' ? 1 : 0;
  const spring = { type: 'spring' as const, stiffness: 320, damping: 18 };
  const fill = broken ? 'var(--game-heart-empty)' : `url(#heart-grad-${uid})`;

  return (
    <span className="relative inline-flex size-7 items-center justify-center">
      {/* Danger glow when critical */}
      {stage === 'critical' && (
        <span
          aria-hidden
          className="game-anim-glow absolute inset-[-5px] rounded-full bg-[radial-gradient(circle,var(--game-heart-glow)_0%,transparent_70%)]"
        />
      )}

      <m.span animate={body} className="relative inline-flex">
        <span
          className={cn(
            'inline-flex',
            (stage === 'full' || stage === 'cracked') && 'game-anim-heartbeat',
            stage === 'critical' && 'game-anim-heartbeat-fast'
          )}
        >
          <svg viewBox="0 0 24 24" className="size-6 overflow-visible" aria-hidden>
            <defs>
              <clipPath id={`heart-l-${uid}`}>
                <polygon points={LEFT_CLIP} />
              </clipPath>
              <clipPath id={`heart-r-${uid}`}>
                <polygon points={RIGHT_CLIP} />
              </clipPath>
              <linearGradient id={`heart-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--game-heart)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--game-heart-dark)' }} />
              </linearGradient>
            </defs>

            {/* Left half */}
            <m.g
              initial={false}
              animate={broken ? { x: -2.4, y: 1.2, rotate: -16 } : { x: 0, y: 0, rotate: 0 }}
              transition={spring}
              style={{ originX: 1, originY: 1 }}
            >
              <path d={HEART} clipPath={`url(#heart-l-${uid})`} style={{ fill }} />
            </m.g>

            {/* Right half */}
            <m.g
              initial={false}
              animate={broken ? { x: 2.4, y: 1.2, rotate: 16 } : { x: 0, y: 0, rotate: 0 }}
              transition={spring}
              style={{ originX: 0, originY: 1 }}
            >
              <path d={HEART} clipPath={`url(#heart-r-${uid})`} style={{ fill }} />
            </m.g>

            {/* Gloss highlight */}
            {!broken && <ellipse cx="7.4" cy="7.6" rx="2.2" ry="1.4" fill="white" opacity="0.45" transform="rotate(-30 7.4 7.6)" />}

            {/* Fracture: grows with each stage */}
            {!broken && (
              <>
                <m.polyline
                  points={CRACK}
                  fill="none"
                  style={{ stroke: 'var(--game-hud-crack)' }}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{ pathLength: crackLength, opacity: crackLength > 0 ? 1 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.45, ease: 'easeOut' }}
                />
                <m.polyline
                  points={CRACK_BRANCH}
                  fill="none"
                  style={{ stroke: 'var(--game-hud-crack)' }}
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{ pathLength: stage === 'critical' ? 1 : 0, opacity: stage === 'critical' ? 1 : 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
                />
              </>
            )}
          </svg>
        </span>
      </m.span>

      {/* Loss shards / gain sparkle ring */}
      <AnimatePresence>
        {burst?.kind === 'loss' && (
          <span key={`loss-${burst.key}`} aria-hidden className="pointer-events-none absolute inset-0">
            <m.span
              className="absolute inset-0 rounded-full bg-white"
              initial={{ opacity: 0.7, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
            {SHARDS.map((s, i) => {
              const rad = s.deg * (Math.PI / 180);
              return (
                <m.span
                  key={i}
                  className="absolute left-1/2 top-1/2 size-[5px] bg-[var(--game-heart)]"
                  style={{ marginLeft: -2.5, marginTop: -2.5, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
                  initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                  animate={{
                    opacity: [1, 1, 0],
                    x: Math.cos(rad) * s.dist,
                    y: [0, Math.sin(rad) * s.dist, Math.sin(rad) * s.dist + 10],
                    rotate: s.rot,
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  onAnimationComplete={i === 0 ? () => setBurst(null) : undefined}
                />
              );
            })}
          </span>
        )}
        {burst?.kind === 'gain' && (
          <m.span
            key={`gain-${burst.key}`}
            aria-hidden
            className="pointer-events-none absolute inset-[-2px] rounded-full border-2 border-[var(--game-heart)]"
            initial={{ opacity: 0.9, scale: 0.5 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            onAnimationComplete={() => setBurst(null)}
          />
        )}
      </AnimatePresence>
    </span>
  );
}
