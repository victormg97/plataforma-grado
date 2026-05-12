'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ViewDetailButtonProps {
  href: string;
  onClick?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ViewDetailButton({ href, onClick }: ViewDetailButtonProps) {
  const t = useTranslations('horarios');

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
