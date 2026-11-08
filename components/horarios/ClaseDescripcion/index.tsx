'use client';

import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';

/** Description block for class detail modals: labelled card with readable rich-text styles. */
export function ClaseDescripcion({ html }: { html: string }) {
  const t = useTranslations('horarios');
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] border-l-2 border-l-[var(--color-brand-gold)] bg-[var(--color-bg-secondary)] px-4 py-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        <FileText className="size-3.5" />
        {t('descripcion')}
      </h3>
      <RichDescription html={html} variant="prose" />
    </section>
  );
}
