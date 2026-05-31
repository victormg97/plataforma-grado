'use client';

import { ReactNode, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { computeTooltipPosition, type TooltipPlacement, type TooltipLayout } from '@/lib/utils/tooltipPosition';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: TooltipPlacement;
  className?: string;
  /**
   * 'default' — solid dark background, high contrast (for standalone action buttons)
   * 'subtle'  — semi-transparent with backdrop blur (for inline/small controls like move arrows)
   */
  variant?: 'default' | 'subtle';
}

export function Tooltip({
  children,
  content,
  position = 'top',
  className = '',
  variant = 'default',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  /**
   * `blocked` is set true when the user clicks while the tooltip is open.
   * It prevents re-showing the tooltip due to synthetic `mouseenter` events
   * that browsers fire when an overlay (like a modal backdrop) unmounts and
   * the pointer is still physically over the trigger element.
   * It is cleared only when pointermove confirms the pointer has moved
   * at least 20px away from the trigger bounding rect.
   */
  const [blocked, setBlocked] = useState(false);
  // Resolved layout (placement + clamped coords + arrow offset).
  const [layout, setLayout] = useState<TooltipLayout>({ placement: position, top: 0, left: 0, arrow: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(true);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    setIsHoverDevice(window.matchMedia('(hover: hover)').matches);
  }, []);

  // Recompute placement from the live trigger + measured bubble size.
  const reposition = useCallback(() => {
    if (!triggerRef.current || !bubbleRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    setLayout(
      computeTooltipPosition(
        triggerRect,
        { width: bubbleRect.width, height: bubbleRect.height },
        position,
      ),
    );
  }, [position]);

  // Measure + position once the bubble is in the DOM, before paint.
  useLayoutEffect(() => {
    if (!visible) return;
    reposition();
  }, [visible, content, reposition]);

  // Keep the tooltip anchored on scroll/resize while visible.
  useEffect(() => {
    if (!visible) return;
    const onMove = () => reposition();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [visible, reposition]);

  // While visible: hide + block on any mousedown (capture phase fires
  // before any React handler, so this catches all clicks including those
  // that open modals).
  useEffect(() => {
    if (!visible) return;
    const hide = () => {
      setVisible(false);
      setBlocked(true);
    };
    document.addEventListener('mousedown', hide, { capture: true });
    return () => document.removeEventListener('mousedown', hide, { capture: true });
  }, [visible]);

  // While blocked: listen to pointermove on the document.
  // Unblock only when the pointer has moved clearly outside the trigger area.
  // This prevents the tooltip from reappearing when a modal closes and the
  // browser fires a synthetic mouseenter on the now-exposed trigger.
  useEffect(() => {
    if (!blocked) return;
    const checkIfAway = (e: PointerEvent) => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const margin = 20; // px clearance before we consider "away"
      if (
        e.clientX < rect.left - margin ||
        e.clientX > rect.right + margin ||
        e.clientY < rect.top - margin ||
        e.clientY > rect.bottom + margin
      ) {
        setBlocked(false);
      }
    };
    document.addEventListener('pointermove', checkIfAway);
    return () => document.removeEventListener('pointermove', checkIfAway);
  }, [blocked]);

  if (!isHoverDevice) return <>{children}</>;

  const showTooltip = () => {
    if (blocked) return; // suppress synthetic re-enter after click/modal
    setVisible(true);
  };

  const hideTooltip = () => setVisible(false);

  // Variant styles
  const isSubtle = variant === 'subtle';
  const bubbleClass = isSubtle
    ? 'pointer-events-none fixed z-[99999] px-2.5 py-1 text-[11px] font-medium tracking-wide text-[var(--color-text-primary)] bg-[var(--color-bg)]/80 backdrop-blur-md rounded-[var(--radius-sm)] shadow-sm ring-1 ring-[var(--color-border)] whitespace-nowrap'
    : 'pointer-events-none fixed z-[99999] px-3 py-1.5 text-xs font-medium tracking-wide text-white bg-[var(--color-brand-black)] rounded-[var(--radius-md)] shadow-[0_4px_12px_rgba(0,0,0,0.15)] ring-1 ring-white/10 dark:ring-white/5 whitespace-nowrap';

  const arrowClass = isSubtle
    ? 'absolute size-2 bg-[var(--color-bg)]/80 backdrop-blur-md rotate-45'
    : 'absolute size-2 bg-[var(--color-brand-black)] rotate-45 border-r border-b border-transparent';

  const { placement, top, left, arrow } = layout;

  // Arrow positioning is driven by the resolved placement + clamped offset so it
  // keeps pointing at the trigger even when the bubble was shifted to fit.
  const arrowStyle: React.CSSProperties =
    placement === 'top'
      ? { bottom: '-3px', left: `${arrow - 4}px` }
      : placement === 'bottom'
      ? { top: '-3px', left: `${arrow - 4}px` }
      : placement === 'left'
      ? { right: '-3px', top: `${arrow - 4}px` }
      : { left: '-3px', top: `${arrow - 4}px` };

  const arrowShadow: React.CSSProperties = isSubtle
    ? placement === 'top'
      ? { boxShadow: '1px 1px 0 var(--color-border)' }
      : placement === 'bottom'
      ? { boxShadow: '-1px -1px 0 var(--color-border)' }
      : placement === 'left'
      ? { boxShadow: '1px -1px 0 var(--color-border)' }
      : { boxShadow: '-1px 1px 0 var(--color-border)' }
    : {};

  return (
    <div
      ref={triggerRef}
      className={`inline-flex ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {visible && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={bubbleRef}
              className={bubbleClass}
              style={{
                top,
                left,
                opacity: 1,
                animation: 'tooltipFadeIn .12s ease-out forwards',
              }}
            >
              {content}
              {/* Arrow */}
              <div className={arrowClass} style={{ ...arrowStyle, ...arrowShadow }} />
              <style>{`
                @keyframes tooltipFadeIn {
                  from { opacity: 0; }
                }
              `}</style>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
