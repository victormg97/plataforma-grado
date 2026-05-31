'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  icon?: ReactNode;
  className?: string;
  /** Overrides the inner content padding wrapper classes (default `px-4 py-3`). */
  contentClassName?: string;
  /** Controlled open state. When provided, the component is controlled. */
  open?: boolean;
  /** Called with the next open state when the header is toggled. */
  onOpenChange?: (open: boolean) => void;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  badge,
  icon,
  className = '',
  contentClassName = 'px-4 py-3',
  open: openProp,
  onOpenChange,
}: CollapsibleProps) {
  const isControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? openProp : internalOpen;

  const toggle = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const contentRef = useRef<HTMLDivElement>(null);

  // Animate height. Initialize from the actual starting open state so a
  // controlled-open accordion doesn't flash an open animation on mount.
  const [height, setHeight] = useState((openProp ?? defaultOpen) ? 'auto' : '0px');
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!contentRef.current) return;
    if (open) {
      const h = contentRef.current.scrollHeight;
      setHeight(`${h}px`);
      const timer = setTimeout(() => setHeight('auto'), 300);
      return () => clearTimeout(timer);
    } else {
      if (height === 'auto') {
        // Collapse from auto: first set explicit height, then animate to 0
        const h = contentRef.current.scrollHeight;
        setHeight(`${h}px`);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHeight('0px');
          });
        });
      } else {
        setHeight('0px');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => { setTransitioning(true); toggle(); }}
        onTransitionEnd={() => setTransitioning(false)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0 text-[var(--color-brand-gold)]">{icon}</span>
          )}
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
          </span>
          {badge !== undefined && (
            <span className="ml-1 inline-flex items-center rounded-full bg-[var(--color-brand-gold-muted)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Content with sliding animation */}
      <div
        ref={contentRef}
        style={{
          height,
          overflow: height === 'auto' && !transitioning ? 'visible' : 'hidden',
          transition: 'height 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className={`border-t border-[var(--color-border)] ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
