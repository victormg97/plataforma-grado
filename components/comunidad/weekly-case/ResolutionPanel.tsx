import { useTranslations } from 'next-intl';
import { Gavel, Lock } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';
import type { WeeklyCaseResolution } from '@/lib/comunidad/weekly-case';

/**
 * The commented resolution ("fallo") when published AND visible to the
 * caller, styled as a gold-sealed ruling. When published but restricted
 * (participants_only) shows a "locked" notice instead (Req. 7).
 */
export function ResolutionPanel({ resolution }: { resolution: WeeklyCaseResolution }) {
  const t = useTranslations('comunidadEstrategica');

  if (!resolution.published) return null;

  if (resolution.locked || !resolution.visible) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--game-radius-sm)] border border-dashed border-[var(--game-border)] bg-[var(--game-surface-muted)] px-4 py-3 text-sm text-[var(--game-text-muted)]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--game-surface)]">
          <Lock className="size-4" />
        </span>
        <span>{t('weekly_case_resolution_locked')}</span>
      </div>
    );
  }

  return (
    <section className="relative flex flex-col gap-3 rounded-[var(--game-radius-sm)] border-2 border-[var(--game-rank-gold)] bg-[var(--game-rank-gold-bg)] p-4 pt-5">
      <span className="absolute -top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--game-rank-gold-light),var(--game-rank-gold))] px-3 py-1 text-xs font-black uppercase tracking-wide text-[var(--game-rank-gold-dark)] shadow-sm">
        <Gavel className="size-3.5" />
        {t('weekly_case_resolution_title')}
      </span>
      <RichDescription html={resolution.content ?? ''} className="text-[var(--game-text)]" />
    </section>
  );
}
