'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  fallback?: string;
  className?: string;
}

export function BackButton({ fallback = '/', className }: BackButtonProps) {
  const router = useRouter();
  const t = useTranslations('common');

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]',
        'hover:text-[var(--color-text-primary)] transition-colors',
        className
      )}
    >
      <ArrowLeft className="size-4" />
      {t('volver')}
    </button>
  );
}
