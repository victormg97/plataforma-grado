'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card } from '@/components/common/Card';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useAdminPointSources, useUpdatePointSource } from '@/lib/hooks/useComunidadAdmin';
import type { GamePointSource } from '@/lib/supabase/types';

/** Points config tab: edit points_value / enabled per action_type (Req. 11). */
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

  if (isLoading) return <Card padding="lg">{t('admin_loading')}</Card>;

  return (
    <div className="flex flex-col gap-3">
      {(sources ?? []).map((src) => (
        <Card key={src.action_type} padding="lg" className="flex flex-wrap items-center gap-4">
          <div className="min-w-[180px] flex-1">
            <div className="font-medium text-[var(--color-text-primary)]">
              {t(`action_${src.action_type}`)}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">{t('admin_points_value')}</span>
            <input
              type="number"
              min={0}
              defaultValue={src.points_value}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== src.points_value && v >= 0) save(src, { points_value: v });
              }}
              className="w-24 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </label>
          <AppSwitch
            checked={src.enabled}
            onChange={(v) => save(src, { enabled: v })}
            label={t('admin_enabled')}
            size="sm"
          />
          <AppSwitch
            checked={src.costs_life ?? false}
            onChange={(v) => save(src, { costs_life: v })}
            label={t('admin_costs_life')}
            size="sm"
          />
        </Card>
      ))}
    </div>
  );
}
