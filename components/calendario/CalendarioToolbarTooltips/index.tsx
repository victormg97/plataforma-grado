'use client';

/**
 * CalendarioToolbarTooltips
 *
 * FullCalendar renders its toolbar buttons (prev, next, today, view switchers,
 * custom buttons) as native <button>s with a `title` attribute, which produces
 * the browser's default tooltip on hover. This component replaces those native
 * tooltips with the app's custom styled, edge-aware tooltip.
 *
 * It works by:
 *  1. Stripping the native `title` (cached as `data-tip`) from each toolbar button.
 *  2. Listening for hover/focus on the toolbar container (event delegation).
 *  3. Rendering a portal bubble positioned via the shared smart-positioning util.
 *
 * Designed to be reusable across all calendar variants — just mount it and pass
 * the container selector plus the labels for the buttons you want to relabel.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { computeTooltipPosition, type TooltipLayout } from '@/lib/utils/tooltipPosition';

interface CalendarioToolbarTooltipsProps {
  /** Scoping selector for the calendar wrapper, e.g. '.calendario-admin'. */
  containerClass: string;
  /**
   * Map of FullCalendar button class fragment → tooltip label.
   * Keys are the FC button class names without the `fc-`/`-button` wrapper,
   * e.g. 'prev', 'next', 'today', 'dayGridMonth', 'nuevaClase'.
   */
  labels: Record<string, string>;
  /** Re-run attachment when this changes (e.g. view/mobile toggles re-render the toolbar). */
  deps?: unknown[];
}

const FC_BUTTON_KEYS = [
  'prev', 'next', 'today', 'hoyIcono',
  'dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek',
  'nuevaClase', 'descargar',
];

export function CalendarioToolbarTooltips({ containerClass, labels, deps = [] }: CalendarioToolbarTooltipsProps) {
  const [label, setLabel] = useState<string | null>(null);
  const [layout, setLayout] = useState<TooltipLayout>({ placement: 'bottom', top: 0, left: 0, arrow: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLElement | null>(null);

  const position = useCallback((btn: HTMLElement) => {
    if (!bubbleRef.current) return;
    const triggerRect = btn.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    // Toolbar sits at the top of the calendar, so prefer opening downward.
    setLayout(
      computeTooltipPosition(
        triggerRect,
        { width: bubbleRect.width, height: bubbleRect.height },
        'bottom',
      ),
    );
  }, []);

  // Reposition once the bubble has rendered (so we know its real size).
  useEffect(() => {
    if (!label || !activeBtnRef.current) return;
    position(activeBtnRef.current);
  }, [label, position]);

  useEffect(() => {
    const container = document.querySelector(containerClass);
    if (!container) return;

    const buttonFor = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const btn = target.closest('button.fc-button') as HTMLElement | null;
      return btn && container.contains(btn) ? btn : null;
    };

    const labelFor = (btn: HTMLElement): string | null => {
      for (const key of FC_BUTTON_KEYS) {
        if (btn.classList.contains(`fc-${key}-button`)) {
          return labels[key] ?? null;
        }
      }
      return null;
    };

    // Strip native titles so the browser tooltip never shows.
    const stripTitles = () => {
      const buttons = container.querySelectorAll<HTMLElement>('button.fc-button');
      buttons.forEach((btn) => {
        if (btn.title) {
          btn.setAttribute('data-tip', btn.title);
          btn.removeAttribute('title');
        }
      });
    };
    stripTitles();
    // FC may re-render the toolbar; re-strip shortly after mount.
    const stripTimer = setTimeout(stripTitles, 200);

    const handleEnter = (e: Event) => {
      const btn = buttonFor(e.target);
      if (!btn) return;
      // Keep stripping in case FC re-added a title on re-render.
      if (btn.title) { btn.setAttribute('data-tip', btn.title); btn.removeAttribute('title'); }
      const text = labelFor(btn);
      if (!text) return;
      activeBtnRef.current = btn;
      setLabel(text);
    };
    const handleLeave = (e: Event) => {
      const btn = buttonFor(e.target);
      if (btn && btn === activeBtnRef.current) {
        activeBtnRef.current = null;
        setLabel(null);
      }
    };
    const handleHide = () => {
      activeBtnRef.current = null;
      setLabel(null);
    };

    container.addEventListener('mouseover', handleEnter);
    container.addEventListener('mouseout', handleLeave);
    container.addEventListener('focusin', handleEnter);
    container.addEventListener('focusout', handleLeave);
    // Hide on click (so it doesn't linger after activating a button).
    container.addEventListener('mousedown', handleHide, true);

    return () => {
      clearTimeout(stripTimer);
      container.removeEventListener('mouseover', handleEnter);
      container.removeEventListener('mouseout', handleLeave);
      container.removeEventListener('focusin', handleEnter);
      container.removeEventListener('focusout', handleLeave);
      container.removeEventListener('mousedown', handleHide, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerClass, labels, ...deps]);

  // Keep anchored on scroll/resize.
  useEffect(() => {
    if (!label) return;
    const onMove = () => { if (activeBtnRef.current) position(activeBtnRef.current); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [label, position]);

  if (!label || typeof document === 'undefined') return null;

  const { placement, top, left, arrow } = layout;
  const arrowStyle: React.CSSProperties =
    placement === 'top'
      ? { bottom: '-3px', left: `${arrow - 4}px` }
      : placement === 'bottom'
      ? { top: '-3px', left: `${arrow - 4}px` }
      : placement === 'left'
      ? { right: '-3px', top: `${arrow - 4}px` }
      : { left: '-3px', top: `${arrow - 4}px` };

  return createPortal(
    <div
      ref={bubbleRef}
      className="pointer-events-none fixed z-[99999] whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--color-brand-black)] px-3 py-1.5 text-xs font-medium tracking-wide text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] ring-1 ring-white/10 dark:ring-white/5"
      style={{ top, left, animation: 'tooltipFadeIn .12s ease-out forwards' }}
    >
      {label}
      <div
        className="absolute size-2 rotate-45 bg-[var(--color-brand-black)]"
        style={arrowStyle}
      />
      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; } }`}</style>
    </div>,
    document.body,
  );
}
