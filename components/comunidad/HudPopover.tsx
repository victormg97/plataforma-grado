'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';

const VIEWPORT_MARGIN = 8;

/**
 * Small game-styled popover for the header HUD (streak, lives).
 *
 * Opens on hover (pointer devices), keyboard focus, or tap/click (touch).
 * Closes on pointer leave, blur, outside tap, or Escape. It renders inside
 * the trigger's wrapper (not a portal) so it keeps the `.game-scope` CSS
 * variables, and it nudges itself horizontally to stay inside the viewport.
 *
 * `forcedOpen` lets the owner pin it open (e.g. to announce a lost streak);
 * while pinned, `pinnedContent` replaces the regular content.
 */
export function HudPopover({
  label,
  trigger,
  children,
  forcedOpen = false,
  pinnedContent,
  onDismissPinned,
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  forcedOpen?: boolean;
  pinnedContent?: ReactNode;
  onDismissPinned?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [shiftX, setShiftX] = useState(0);

  const pinned = forcedOpen && !!pinnedContent;
  const open = pinned || hovered || toggled;

  const close = useCallback(() => {
    setHovered(false);
    setToggled(false);
    if (pinned) onDismissPinned?.();
  }, [pinned, onDismissPinned]);

  // Outside tap + Escape close the popover.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Keep the bubble inside the viewport (mobile headers wrap a lot).
  useLayoutEffect(() => {
    if (!open || !bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    const naturalLeft = rect.left - shiftX;
    const naturalRight = naturalLeft + rect.width;
    let next = 0;
    if (naturalLeft < VIEWPORT_MARGIN) next = VIEWPORT_MARGIN - naturalLeft;
    else if (naturalRight > window.innerWidth - VIEWPORT_MARGIN) {
      next = window.innerWidth - VIEWPORT_MARGIN - naturalRight;
    }
    if (next !== shiftX) setShiftX(next);  
    // shiftX intentionally excluded: we measure relative to the current shift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pinned]);

  const isHoverDevice = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setHovered(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          // On hover devices the hover already opens it; a click pins it.
          if (pinned) {
            close();
            return;
          }
          setToggled((v) => (isHoverDevice() ? true : !v));
        }}
        onFocus={(e) => {
          // Only keyboard focus opens it; pointer focus is handled by click
          // (otherwise a tap would open on focus and immediately toggle shut).
          if (e.currentTarget.matches(':focus-visible')) setToggled(true);
        }}
        onBlur={(e) => {
          if (!wrapperRef.current?.contains(e.relatedTarget as Node)) setToggled(false);
        }}
        className="rounded-[var(--game-radius-sm)] px-1.5 py-1 text-left outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <div
            key="hud-popover"
            className="pointer-events-none absolute left-1/2 top-full z-50 pt-2"
            style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
          >
            <m.div
              ref={bubbleRef}
              id={id}
              role={pinned ? 'alert' : 'tooltip'}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.92 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 520, damping: 30, mass: 0.6 }}
              style={{ transformOrigin: 'top center' }}
              className="pointer-events-auto relative w-64 rounded-[var(--game-radius-sm)] border border-white/10 bg-[var(--game-popover-bg)] p-3 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]"
            >
              {/* Arrow */}
              <span
                aria-hidden
                className="absolute -top-1.5 size-3 rotate-45 border-l border-t border-white/10 bg-[var(--game-popover-bg)]"
                style={{ left: `calc(50% - 6px - ${shiftX}px)` }}
              />
              <div className="relative">{pinned ? pinnedContent : children}</div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
