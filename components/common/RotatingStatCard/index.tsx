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
  /** Optional per-item icon. Falls back to the card-level icon. */
  icon?: ReactNode;
  /** Optional per-item accent color. Falls back to the card-level color. */
  color?: string;
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
  /** Show the position dots indicating which item is active. Default true. */
  showIndicators?: boolean;
  className?: string;
}

// Slide variants using translateY so exiting items move out of the clip box.
const variants = {
  enter: (dir: number) => ({ y: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { y: '0%', opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

export function RotatingStatCard({
  items,
  icon,
  color = 'var(--color-text-primary)',
  intervalMs = 4000,
  onlyWithData = true,
  ariaLabel = 'dato',
  showIndicators = true,
  className = '',
}: RotatingStatCardProps) {
  const visible = useMemo(() => {
    const filtered = onlyWithData
      ? items.filter((i) => (typeof i.value === 'number' ? i.value > 0 : true))
      : items;
    return filtered.length > 0 ? filtered : items.slice(0, 1);
  }, [items, onlyWithData]);

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hovering, setHovering] = useState(false);

  const prevVisibleLengthRef = useRef(visible.length);
  useEffect(() => {
    if (prevVisibleLengthRef.current !== visible.length) {
      prevVisibleLengthRef.current = visible.length;
      setIndex(0);
    }
  }, [visible.length]);

  const safeIndex = visible.length > 0 ? index % visible.length : 0;

  const go = useCallback(
    (dir: number) => {
      if (visible.length < 2) return;
      setDirection(dir);
      setIndex((i) => ((i % visible.length) + dir + visible.length) % visible.length);
    },
    [visible.length],
  );

  useEffect(() => {
    if (hovering || visible.length < 2) return;
    const id = setTimeout(() => go(1), intervalMs);
    return () => clearTimeout(id);
  }, [safeIndex, hovering, visible.length, intervalMs, go]);

  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    if (Math.abs(dy) > 30) go(dy < 0 ? 1 : -1);
    touchStartY.current = null;
  };

  const current = visible[safeIndex];
  const canRotate = visible.length > 1;
  const activeIcon = current?.icon ?? icon;
  const activeColor = current?.color ?? color;

  const displayValue =
    current == null || current.value === undefined || current.value === null
      ? '—'
      : current.value;

  return (
    <Card
      padding="md"
      className={`relative group ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center gap-3">
        {/* Icon bubble — overflow-hidden scoped here so the slide clips within
            the bubble only, leaving the rest of the card untouched. */}
        {activeIcon && (
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
            <AnimatePresence custom={direction} initial={false}>
              <m.div
                key={current?.key}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                className="absolute inset-0 flex items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${activeColor} 12%, transparent)` }}
              >
                <span style={{ color: activeColor }}>{activeIcon}</span>
              </m.div>
            </AnimatePresence>
          </div>
        )}

        {/* Value / label area.
            The outer div uses overflow:hidden + a fixed height that exactly
            matches the static stat cards:
              - text-2xl (line-height ≈ 2rem / 32px) with leading-none
              - mt-1 (4px gap)
              - text-xs (line-height = 1rem / 16px)
              Total = 52px.
            The animated m.div is position:absolute so it never contributes to
            layout height, and the outer div's explicit height keeps it equal to
            the sibling static cards so items-center aligns everything correctly.
        */}
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{ height: '3.25rem' /* 52px */ }}
        >
          <AnimatePresence custom={direction} initial={false}>
            <m.div
              key={current?.key}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="absolute inset-x-0 top-0 flex h-full flex-col justify-center"
            >
              <p className="text-2xl font-bold leading-none text-[var(--color-text-primary)]">
                {displayValue}
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
      {canRotate && showIndicators && (
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
          {visible.map((it, i) => (
            <span
              key={it.key}
              className="size-1 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i === safeIndex ? activeColor : 'var(--color-border-strong)',
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
