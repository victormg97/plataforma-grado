'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/common/Card';

/**
 * Consistent error state for the mini-app (player) views, styled with the game
 * tokens. Optionally offers a retry action. All text is i18n.
 */
export function GameErrorState({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations('comunidadEstrategica');

  return (
    <Card
      padding="lg"
      className="flex flex-col items-center gap-3 border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]"
      role="alert"
    >
      <AlertCircle className="size-8 text-[var(--game-incorrect)]" />
      <p className="text-sm text-[var(--game-text-muted)]">{t('error_loading')}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-4 py-2 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
        >
          {t('error_retry')}
        </button>
      )}
    </Card>
  );
}
