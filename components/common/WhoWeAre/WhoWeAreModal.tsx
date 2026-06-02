'use client';

import { useState, useEffect } from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { HeroImage } from './HeroImage';
import { ContactColumn } from './ContactColumn';
import { useHeroImage } from './hooks/useHeroImage';
import { useContactInfo } from './hooks/useContactInfo';

interface WhoWeAreModalProps {
  tenantSlug: string;
  locale: string;
  markdown: string;
  onClose: () => void;
}

export function WhoWeAreModal({ tenantSlug, markdown, onClose }: WhoWeAreModalProps) {
  const t = useTranslations('quienesSomos');
  const { url: heroUrl, found: heroFound } = useHeroImage(tenantSlug);
  const { entries } = useContactInfo(tenantSlug);
  const [contactOpen, setContactOpen] = useState(false);

  // Bloquear el scroll de la página de fondo mientras el modal está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Cerrar con Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <LazyMotion features={domAnimation}>
      {/* Backdrop */}
      <m.div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <m.div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div
          className="relative w-[90vw] max-w-5xl h-[85vh] rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] overflow-hidden flex pointer-events-auto"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {/* ── Close button ── */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('modal_cerrar')}
            className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="size-4" />
          </button>

          {/* ── Desktop layout (md+) ── */}
          <div className="hidden md:flex w-full h-full">
            {/* Left: Hero image */}
            {heroFound && heroUrl && (
              <div className="w-64 shrink-0 h-full">
                <HeroImage url={heroUrl} className="w-full h-full" />
              </div>
            )}

            {/* Center: Markdown content */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto px-6 py-8 pr-4">
              <div style={{ fontFamily: 'var(--font-body)' }}>
                <MarkdownRenderer content={markdown} />
              </div>
            </div>

            {/* Right: Contact column */}
            <div className="w-64 shrink-0 h-full overflow-y-auto border-l border-[var(--color-border)] px-4 py-8">
              <ContactColumn entries={entries} />
            </div>
          </div>

          {/* ── Mobile layout (< md) ── */}
          <div className="flex md:hidden w-full h-full flex-col relative overflow-hidden">
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left: Hero image strip */}
              {heroFound && heroUrl && (
                <div className="w-12 shrink-0 h-full">
                  <HeroImage url={heroUrl} className="w-full h-full" />
                </div>
              )}

              {/* Center: Markdown content */}
              <div className="flex-1 min-w-0 h-full overflow-y-auto px-4 py-6 pb-16">
                <div style={{ fontFamily: 'var(--font-body)' }}>
                  <MarkdownRenderer content={markdown} />
                </div>
              </div>
            </div>

            {/* ── Mobile contact bottom sheet ──
                The toggle IS the sheet header: it rises together with the
                content when opening, and tapping it (now "Cerrar contacto")
                slides the sheet back down. Anchored at bottom-0 and grows
                upward, so there's no gap between the header and the list. */}
            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]">
              <button
                type="button"
                onClick={() => setContactOpen((v) => !v)}
                aria-expanded={contactOpen}
                className="w-full flex items-center justify-center gap-2 rounded-t-[var(--radius-xl)] py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                {contactOpen ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronUp className="size-4" />
                )}
                {contactOpen ? t('contacto_toggle_cerrar') : t('contacto_toggle_abrir')}
              </button>

              <m.div
                initial={false}
                animate={{ height: contactOpen ? 'auto' : 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="max-h-[55vh] overflow-y-auto border-t border-[var(--color-border)] px-4 py-4">
                  <ContactColumn entries={entries} />
                </div>
              </m.div>
            </div>
          </div>
        </div>
      </m.div>
    </LazyMotion>
  );
}
