'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useAdminPointSources, useUpdatePointSource } from '@/lib/hooks/useComunidadAdmin';
import type { GamePointSource } from '@/lib/supabase/types';
import { ConfigCallout } from '../ui';

/** Points config tab: edit points_value / enabled / costs_life per action. */
export function PointsTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data: sources, isLoading } = useAdminPointSources();
  const update = useUpdatePointSource();

  const save = async (src: GamePointSource, patch: Partial<GamePointSource>) => {
    try {
      await update.mutateAsync({
        action_type: src.action_type,
        points_value: patch.points_value ?? src.points_value,
        enabled: patch.enabled ?? src.enabled,
        counts_for_streak: patch.counts_for_streak ?? src.counts_for_streak,
        costs_life: patch.costs_life ?? src.costs_life,
      });
      toast.success(t('admin_saved'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  if (isLoading) return <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>;

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('points_intro_title')}>{t('points_intro_desc')}</ConfigCallout>

      <div className="flex flex-col gap-3">
        {(sources ?? []).map((src) => (
          <Card key={src.action_type} padding="lg" className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-[var(--color-brand-gold)]">
                <Star className="size-4" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t(`action_${src.action_type}`)}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t(`points_action_desc_${src.action_type}`)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-4 sm:pl-7">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('points_value_label')}
                </span>
                <input
                  type="number"
                  min={0}
                  defaultValue={src.points_value}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== src.points_value && v >= 0) save(src, { points_value: v });
                  }}
                  className="w-28 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
                />
              </label>

              <AppSwitch
                checked={src.enabled}
                onChange={(v) => save(src, { enabled: v })}
                label={t('points_enabled_label')}
                size="sm"
              />
              <AppSwitch
                checked={src.costs_life ?? false}
                onChange={(v) => save(src, { costs_life: v })}
                label={t('admin_costs_life')}
                size="sm"
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
