'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { createPortal } from 'react-dom';
import { tenantConfig } from '@/config';
import { useWhoWeAreContent } from './hooks/useWhoWeAreContent';
import { WhoWeAreModal } from './WhoWeAreModal';

interface WhoWeAreProps {
  tenantSlug: string;
  locale: string;
}

export function WhoWeAre({ tenantSlug, locale }: WhoWeAreProps) {
  const t = useTranslations('quienesSomos');
  const { markdown, status } = useWhoWeAreContent(tenantSlug, locale);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = tenantConfig.quienesSomosLabel ?? t('boton_aria');

  useEffect(() => { setMounted(true); }, []);

  const measureTrigger = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const openPopover = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    measureTrigger();
    setPopoverOpen(true);
  }, [measureTrigger]);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setPopoverOpen(false), 120);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (status !== 'resolved' || !markdown) return null;

  return (
    <>
      {/* ── Desktop: icon button with hover popover ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        aria-label={label}
        className="hidden md:flex opacity-50 hover:opacity-100 transition-opacity items-center justify-center"
      >
        <Users className="size-5 text-[var(--color-text-primary)]" />
      </button>

      {/* Desktop popover — portal */}
      {popoverOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="tooltip"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="fixed z-[99999] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] whitespace-nowrap"
          style={{
            top: coords.top,
            left: coords.left,
            transform: 'translateX(-50%)',
            animation: 'whoWeArePopoverIn .12s ease-out',
          }}
        >
          <button
            type="button"
            onClick={() => { setPopoverOpen(false); setIsOpen(true); }}
            className="flex items-center gap-1.5 hover:text-[var(--color-brand-gold)] transition-colors"
          >
            <Users className="size-3.5 text-[var(--color-text-muted)]" />
            {label}
          </button>
          <style>{`
            @keyframes whoWeArePopoverIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}

      {/* ── Mobile: icon + clickable label side by side ── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={label}
        className="md:hidden flex items-center gap-1.5 opacity-50 hover:opacity-100 active:opacity-100 transition-opacity"
      >
        <Users className="size-4 text-[var(--color-text-primary)]" />
        <span className="text-xs font-medium text-[var(--color-text-primary)]">{label}</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <WhoWeAreModal
            tenantSlug={tenantSlug}
            locale={locale}
            markdown={markdown}
            onClose={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
