'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
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
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(true);

  useEffect(() => {
    setMounted(true);
    setIsHoverDevice(window.matchMedia('(hover: hover)').matches);
  }, []);

  if (!isHoverDevice) return <>{children}</>;

  const showTooltip = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let top = 0;
      let left = 0;
      const offset = 6;

      switch (position) {
        case 'top':
          top = rect.top - offset;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - offset;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + offset;
          break;
      }
      setCoords({ top, left });
      setVisible(true);
    }
  };

  const hideTooltip = () => setVisible(false);

  // Variant styles
  const isSubtle = variant === 'subtle';
  const bubbleClass = isSubtle
    ? 'pointer-events-none fixed z-[99999] px-2.5 py-1 text-[11px] font-medium tracking-wide text-[var(--color-text-primary)] bg-[var(--color-bg)]/80 backdrop-blur-md rounded-[var(--radius-sm)] shadow-sm ring-1 ring-[var(--color-border)] whitespace-nowrap'
    : 'pointer-events-none fixed z-[99999] px-3 py-1.5 text-xs font-medium tracking-wide text-white bg-[var(--color-brand-black)] rounded-[var(--radius-md)] shadow-[0_4px_12px_rgba(0,0,0,0.15)] ring-1 ring-white/10 dark:ring-white/5 whitespace-nowrap';

  const arrowClass = isSubtle
    ? 'absolute w-2 h-2 bg-[var(--color-bg)]/80 backdrop-blur-md rotate-45'
    : 'absolute w-2 h-2 bg-[var(--color-brand-black)] rotate-45 border-r border-b border-transparent';

  const transform =
    position === 'top'
      ? 'translate(-50%, -100%) scale(1)'
      : position === 'bottom'
      ? 'translate(-50%, 0) scale(1)'
      : position === 'left'
      ? 'translate(-100%, -50%) scale(1)'
      : 'translate(0, -50%) scale(1)';

  const animFrom =
    position === 'top'
      ? 'translate(-50%, calc(-100% + 4px))'
      : position === 'bottom'
      ? 'translate(-50%, -4px)'
      : position === 'left'
      ? 'translate(calc(-100% + 4px), -50%)'
      : 'translate(-4px, -50%)';

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
              className={bubbleClass}
              style={{
                top: coords.top,
                left: coords.left,
                transform,
                opacity: 1,
                animation: 'tooltipFadeIn .12s ease-out forwards',
              }}
            >
              {content}
              {/* Arrow */}
              <div
                className={arrowClass}
                style={{
                  ...(position === 'top' && {
                    bottom: '-3px',
                    left: 'calc(50% - 4px)',
                    ...(isSubtle
                      ? { boxShadow: '1px 1px 0 var(--color-border)' }
                      : { borderRightColor: 'hsla(0,0%,100%,0.1)', borderBottomColor: 'hsla(0,0%,100%,0.1)' }),
                  }),
                  ...(position === 'bottom' && {
                    top: '-3px',
                    left: 'calc(50% - 4px)',
                    ...(isSubtle
                      ? { boxShadow: '-1px -1px 0 var(--color-border)' }
                      : { borderTopColor: 'hsla(0,0%,100%,0.1)', borderLeftColor: 'hsla(0,0%,100%,0.1)' }),
                  }),
                  ...(position === 'left' && {
                    right: '-3px',
                    top: 'calc(50% - 4px)',
                    ...(isSubtle
                      ? { boxShadow: '1px -1px 0 var(--color-border)' }
                      : { borderTopColor: 'hsla(0,0%,100%,0.1)', borderRightColor: 'hsla(0,0%,100%,0.1)' }),
                  }),
                  ...(position === 'right' && {
                    left: '-3px',
                    top: 'calc(50% - 4px)',
                    ...(isSubtle
                      ? { boxShadow: '-1px 1px 0 var(--color-border)' }
                      : { borderBottomColor: 'hsla(0,0%,100%,0.1)', borderLeftColor: 'hsla(0,0%,100%,0.1)' }),
                  }),
                }}
              />
              <style>{`
                @keyframes tooltipFadeIn {
                  from { opacity: 0; transform: ${animFrom}; }
                }
              `}</style>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
