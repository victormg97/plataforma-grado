'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
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

  // Don't render while loading or if content not found
  if (status !== 'resolved' || !markdown) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t('boton_aria')}
        className="opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <Users className="size-5 text-[var(--color-text-primary)]" />
      </button>

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
