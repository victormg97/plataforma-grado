'use client';

import { useTranslations } from 'next-intl';
import { GoogleButton } from '@/components/auth/GoogleButton';

interface BloqueGoogleProps {
  code: string;
}

export function BloqueGoogle({ code }: BloqueGoogleProps) {
  const t = useTranslations('registro');

  return (
    <div className="space-y-4">
      <GoogleButton
        label={t('google_boton')}
        callbackPath="/api/auth/registro/callback"
        callbackQuery={{ inv: code }}
      />

      {/* Divisor */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">{t('divisor')}</span>
        <div className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
