'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal,
  Eye,
  Download,
  ExternalLink,
  Play,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/common/Tooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface CardActionsProps {
  /** Actions to show in the popover (mobile) and as icon buttons (desktop) */
  actions: CardAction[];
  /** Extra class for the desktop button row wrapper */
  className?: string;
  /**
   * When true, desktop icon buttons are always visible (no group-hover fade).
   * Useful when the card doesn't rely on hover to reveal actions.
   */
  alwaysVisible?: boolean;
  /**
   * When true, only the ⋯ ellipsis trigger + popover are rendered (no desktop
   * icon row). The caller is responsible for controlling visibility via wrapper
   * classes (e.g. `sm:hidden`). Useful when the desktop layout is custom.
   */
  mobileOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CardActions({ actions, className, alwaysVisible = false, mobileOnly = false }: CardActionsProps) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ top: 0, right: 0 });

  // Estimación de la altura del popover: cada item ~44px + padding vertical.
  const estimatedHeight = actions.length * 44 + 8;
  const MARGIN = 8; // separación mínima respecto a los bordes de la ventana

  // Calcula la mejor posición (arriba/abajo) según el espacio disponible.
  const computePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const right = Math.max(MARGIN, window.innerWidth - rect.right);

    // Por defecto se abre hacia abajo; si no cabe y hay más espacio arriba, se
    // abre hacia arriba para que las opciones nunca queden fuera de la pantalla.
    const openUp = spaceBelow < estimatedHeight + MARGIN && spaceAbove > spaceBelow;

    if (openUp) {
      // Anclar por el borde inferior: el menú queda pegado al trigger sin hueco,
      // sin depender de la altura real (que puede diferir de la estimada).
      setPos({ bottom: window.innerHeight - rect.top + 6, right });
    } else {
      setPos({ top: rect.bottom + 6, right });
    }
  };

  // Close on outside click or Escape; recolocar al hacer scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onReposition = () => computePosition();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!triggerRef.current) return;
    computePosition();
    setOpen((v) => !v);
  };

  if (actions.length === 0) return null;

  return (
    <>
      {/* ── Desktop: icon buttons, fade in on group-hover (skipped in mobileOnly) ── */}
      {!mobileOnly && (
        <div className={cn('hidden lg:flex flex-shrink-0 items-start gap-0.5 pt-0.5', className)}>
          {actions.map((action) => (
            <Tooltip key={action.key} content={action.label} position="top">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                aria-label={action.label}
                className={cn(
                  'flex size-9 items-center justify-center rounded-[var(--radius-sm)]',
                  'text-[var(--color-text-muted)] transition-colors',
                  alwaysVisible
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 transition-opacity',
                  action.danger
                    ? 'hover:bg-[rgba(192,57,43,0.1)] hover:text-[var(--color-error)]'
                    : 'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {action.icon}
              </button>
            </Tooltip>
          ))}
        </div>
      )}

      {/* ── Mobile: single ⋯ trigger ── */}
      {/* In mobileOnly mode the caller controls visibility; otherwise hide on lg+ */}
      <div className={cn('flex flex-shrink-0 items-start pt-0.5', !mobileOnly && 'lg:hidden')}>
        <button
          ref={triggerRef}
          type="button"
          onClick={handleTrigger}
          aria-label={t('acciones')}
          aria-expanded={open}
          className={cn(
            'flex size-9 items-center justify-center rounded-[var(--radius-sm)]',
            'text-[var(--color-text-muted)] transition-colors',
            'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
            open && 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {/* ── Popover (portal, mobile only) ── */}
      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          style={{
            top: pos.top,
            bottom: pos.bottom,
            right: pos.right,
            maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
          }}
          className={cn(
            'fixed z-[70] min-w-[160px] overflow-y-auto rounded-[var(--radius-lg)]',
            'border border-[var(--color-border)] bg-[var(--color-bg)]',
            'shadow-[var(--shadow-lg)] py-1',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                action.danger
                  ? 'text-[var(--color-error)] hover:bg-[rgba(192,57,43,0.08)]'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
              )}
            >
              <span className="size-4 flex-shrink-0">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Icon helpers (re-exported for convenience) ───────────────────────────────

export { Eye, Download, ExternalLink, Play, Pencil, Trash2 };
