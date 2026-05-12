'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Info, FileText, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const ITEMS = [
  { key: 'terminos', href: '/terminos', Icon: FileText },
  { key: 'privacidad', href: '/privacidad', Icon: ShieldCheck },
] as const;

/**
 * AppInfoPopover — sidebar footer info button.
 *
 * Desktop (hover device): opens on mouse-enter, stays open while the pointer
 * is inside the popover panel (grace-period timer approach).
 * Mobile/touch: opens on click, closes on outside click.
 */
export function AppInfoPopover() {
  const t = useTranslations('info');
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ bottom: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setIsHoverDevice(window.matchMedia('(hover: hover)').matches);
  }, []);

  const measureTrigger = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left + rect.width / 2,
      width: rect.width,
    });
  }, []);

  const openPopover = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    measureTrigger();
    setOpen(true);
  }, [measureTrigger]);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Click-outside for touch devices
  useEffect(() => {
    if (isHoverDevice || !open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isHoverDevice, open]);

  const triggerProps = isHoverDevice
    ? { onMouseEnter: openPopover, onMouseLeave: scheduleClose }
    : { onClick: () => (open ? setOpen(false) : openPopover()) };

  const panelProps = isHoverDevice
    ? { onMouseEnter: cancelClose, onMouseLeave: scheduleClose }
    : {};

  return (
    <>
      <button
        ref={triggerRef}
        aria-label={t('title')}
        aria-expanded={open}
        className={cn(
          'flex size-7 items-center justify-center rounded-[var(--radius-md)] transition-colors',
          open
            ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
        )}
        {...triggerProps}
      >
        <Info className="size-3.5" />
      </button>

      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={t('title')}
              className="fixed z-[99999] w-52 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] overflow-hidden"
              style={{
                bottom: coords.bottom,
                left: coords.left,
                transform: 'translateX(-50%)',
                animation: 'infoPopoverIn .12s ease-out',
              }}
              {...panelProps}
            >
              <div className="px-3 py-2 border-b border-[var(--color-border)]">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {t('title')}
                </p>
              </div>
              <div className="py-1">
                {ITEMS.map(({ key, href, Icon }) => (
                  <Link
                    key={key}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    <Icon className="size-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />
                    {t(key)}
                  </Link>
                ))}
              </div>
              <style>{`
                @keyframes infoPopoverIn {
                  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
                  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
              `}</style>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
