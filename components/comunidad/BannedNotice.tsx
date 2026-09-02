'use client';

import { useTranslations } from 'next-intl';
import { Ban } from 'lucide-react';
import { Card } from '@/components/common/Card';

/**
 * Full replacement for gameplay when the player is banned. Shows the ban
 * message and, if the admin provided one, the reason.
 */
export function BannedNotice({ reason }: { reason: string | null }) {
  const t = useTranslations('comunidadEstrategica');

  return (
    <Card
      padding="lg"
      className="flex flex-col items-center gap-3 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
      role="alert"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--game-accent-muted)]">
        <Ban className="size-7 text-[var(--game-incorrect)]" />
      </div>
      <h2 className="text-lg font-bold text-[var(--game-text)]">{t('banned_title')}</h2>
      <p className="max-w-md text-sm text-[var(--game-text-muted)]">{t('banned_desc')}</p>
      {reason && (
        <div className="mt-1 w-full max-w-md rounded-[var(--game-radius-sm)] bg-[var(--game-surface-muted)] px-4 py-3 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--game-text-muted)]">
            {t('banned_reason_label')}
          </div>
          <p className="text-sm text-[var(--game-text)]">{reason}</p>
        </div>
      )}
    </Card>
  );
}
