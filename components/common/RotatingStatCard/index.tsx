'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Card } from '@/components/common/Card';

export interface RotatingStatItem {
  /** Stable key, used for animation identity. */
  key: string;
  value: number | string;
  label: string;
}

interface RotatingStatCardProps {
  items: RotatingStatItem[];
  /** Fixed icon shown on the left of the card. */
  icon?: ReactNode;
  /** Accent color (CSS value) for the icon bubble. */
  color?: string;
  /** Auto-rotate interval in ms. */
  intervalMs?: number;
  /**
   * When true (default), only items with a numeric value > 0 rotate.
   * If none qualify, the first item is shown so the card is never empty.
   */
  onlyWithData?: boolean;
  /** Accessible label for the up/down controls (e.g. "estadística"). */
  ariaLabel?: string;
  className?: string;
}

const variants = {
  enter: (dir: number) => ({ y: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { y: '0%', opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

/**
 * A dashboard stat card that auto-rotates between several values (vertical,
 * carousel-like). Pauses on hover; on desktop, hovering reveals up/down
 * controls on the right; on touch devices, a vertical swipe changes the value.
 *
 * Reusable: pass any set of {value, label} items. Auto-rotation only runs when
 * there are at least two items to show.
 */
export function RotatingStatCard({
  items,
  icon,
  color = 'var(--color-text-primary)',
  intervalMs = 4000,
  onlyWithData = true,
  ariaLabel = 'dato',
  className = '',
}: RotatingStatCardProps) {
  // Items eligible to rotate. Never collapse to empty.
  const visible = useMemo(() => {
    const filtered = onlyWithData
      ? items.filter((i) => (typeof i.value === 'number' ? i.value > 0 : true))
      : items;
    return filtered.length > 0 ? filtered : items.slice(0, 1);
  }, [items, onlyWithData]);

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = next/down, -1 = prev/up
  const [hovering, setHovering] = useState(false);

  // Derive a safe index instead of clamping via an effect (avoids cascading
  // renders). Stays valid even if the visible set shrinks.
  const safeIndex = visible.length > 0 ? index % visible.length : 0;

  const go = useCallback(
    (dir: number) => {
      if (visible.length < 2) return;
      setDirection(dir);
      setIndex((i) => ((i % visible.length) + dir + visible.length) % visible.length);
    },
    [visible.length]
  );

  // Auto-rotate: a self-resetting timeout. Resets after every change (manual
  // or automatic) so a manual nav gets a full interval before the next auto-step.
  useEffect(() => {
    if (hovering || visible.length < 2) return;
    const id = setTimeout(() => go(1), intervalMs);
    return () => clearTimeout(id);
  }, [safeIndex, hovering, visible.length, intervalMs, go]);

  // Touch swipe (vertical).
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    if (Math.abs(dy) > 30) go(dy < 0 ? 1 : -1); // swipe up → next
    touchStartY.current = null;
  };

  const current = visible[safeIndex];
  const canRotate = visible.length > 1;

  return (
    <Card
      padding="md"
      className={`relative overflow-hidden group ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            <span style={{ color }}>{icon}</span>
          </div>
        )}

        {/* Rotating value/label area */}
        <div className="relative h-11 flex-1 min-w-0">
          <AnimatePresence custom={direction} initial={false}>
            <m.div
              key={current?.key}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="absolute inset-0 flex flex-col justify-center"
            >
              <p className="text-2xl font-bold leading-none text-[var(--color-text-primary)]">
                {current?.value}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                {current?.label}
              </p>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Desktop hover controls */}
      {canRotate && (
        <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 flex-col gap-0.5 opacity-0 transition-opacity duration-200 md:flex group-hover:opacity-100">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={`${ariaLabel} anterior`}
            className="flex size-5 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={`${ariaLabel} siguiente`}
            className="flex size-5 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      )}

      {/* Position dots */}
      {canRotate && (
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
          {visible.map((it, i) => (
            <span
              key={it.key}
              className="size-1 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i === safeIndex ? color : 'var(--color-border-strong)',
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
