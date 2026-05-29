'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLinkModal } from '@/components/common/ExternalLinkModal';

type LinkWarningModalProps = {
  url: string;
  authorName: string;
  authorId: string;
  authorRole: string;
  onConfirm: (trust: boolean) => void;
  onCancel: () => void;
};

export function LinkWarningModal({
  url,
  authorName,
  authorRole,
  onConfirm,
  onCancel,
}: LinkWarningModalProps) {
  const t = useTranslations('notas');
  const [trust, setTrust] = useState(false);
  const isProfesor = authorRole === 'profesor';

  return (
    <ExternalLinkModal
      url={url}
      onConfirm={() => onConfirm(trust)}
      onCancel={onCancel}
    >
      {/* Trust checkbox — only for profesor-authored links */}
      {isProfesor && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trust}
            onChange={(e) => setTrust(e.target.checked)}
            className="size-4 rounded border-[var(--color-border)] accent-[var(--color-brand-gold)] cursor-pointer"
          />
          <span className="text-sm text-[var(--color-text-primary)]">
            {t('advertencia_enlace_confiar', { nombre: authorName })}
          </span>
        </label>
      )}
    </ExternalLinkModal>
  );
}
