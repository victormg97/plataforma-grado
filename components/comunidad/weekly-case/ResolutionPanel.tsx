import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';
import type { WeeklyCaseResolution } from '@/lib/comunidad/weekly-case';

/**
 * Renders the commented resolution when it is published AND visible to the
 * caller. When published but restricted (participants_only) shows a "locked"
 * notice instead (Req. 7).
 */
export function ResolutionPanel({ resolution }: { resolution: WeeklyCaseResolution }) {
  const t = useTranslations('comunidadEstrategica');

  if (!resolution.published) {
    return null;
  }

  if (resolution.locked || !resolution.visible) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-surface-muted)] px-4 py-3 text-sm text-[var(--game-text-muted)]">
        <Lock className="size-4 shrink-0" />
        <span>{t('weekly_case_resolution_locked')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-[var(--game-accent)]">
        {t('weekly_case_resolution_title')}
      </h4>
      <RichDescription
        html={resolution.content ?? ''}
        className="text-[var(--game-text)]"
      />
    </div>
  );
}
