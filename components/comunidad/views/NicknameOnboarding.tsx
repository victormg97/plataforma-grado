'use client';

import { useTranslations } from 'next-intl';
import { UserRoundPen } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { NicknameForm } from '../NicknameForm';

/**
 * Onboarding flow shown when the player has no nickname yet. Must be
 * completed before accessing the Pregunta del Día (Req. 6.5 / 3.1).
 */
export function NicknameOnboarding({ onDone }: { onDone: () => void }) {
  const t = useTranslations('comunidadEstrategica');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Card padding="lg" className="flex flex-col gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-[var(--game-accent)] text-[var(--game-on-accent)]">
            <UserRoundPen className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--game-text)]">
              {t('onboarding_title')}
            </h2>
            <p className="text-sm text-[var(--game-text-muted)]">{t('onboarding_subtitle')}</p>
          </div>
        </div>

        <NicknameForm submitLabel={t('onboarding_submit')} onSaved={() => onDone()} />
      </Card>
    </div>
  );
}
