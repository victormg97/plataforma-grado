'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ViewDetailButtonProps {
  href: string;
  onClick?: () => void;
  /** Compact button style, meant for modal footers. */
  compact?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ViewDetailButton({ href, onClick, compact = false }: ViewDetailButtonProps) {
  const t = useTranslations('horarios');
  if (compact) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className="group inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-gold)] px-5 text-sm font-medium text-[var(--color-brand-gold)] transition-colors hover:bg-[var(--color-brand-gold-muted)]"
      >
        {t('ver_detalle_completo')}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    );
  }
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group mt-1 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 transition-all hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]"
    >
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-gold)]">
          {t('ver_detalle_completo')}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('ver_detalle_desc')}
        </p>
      </div>
      <ArrowRight className="size-4 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-gold)]" />
    </Link>
  );
}
