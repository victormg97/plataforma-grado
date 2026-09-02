'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSwitch } from '@/components/common/AppSwitch';
import {
  useAdminPointSources,
  useUpdatePointSource,
  useStreakThresholds,
  useUpdateStreakThresholds,
} from '@/lib/hooks/useComunidadAdmin';
import type { GamePointSource, GameStreakThreshold } from '@/lib/supabase/types';

/** Streak config tab: which actions count for streak + thresholds (Req. 12). */
export function StreakTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data: sources } = useAdminPointSources();
  const updateSource = useUpdatePointSource();
  const { data: thresholds } = useStreakThresholds();

  const toggleStreak = async (src: GamePointSource, counts: boolean) => {
    try {
      await updateSource.mutateAsync({
        action_type: src.action_type,
        points_value: src.points_value,
        enabled: src.enabled,
        counts_for_streak: counts,
      });
      toast.success(t('admin_saved'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('admin_streak_actions')}
        </h3>
        {(sources ?? []).map((src) => (
          <AppSwitch
            key={src.action_type}
            checked={src.counts_for_streak}
            onChange={(v) => toggleStreak(src, v)}
            label={t(`action_${src.action_type}`)}
          />
        ))}
      </Card>

      {thresholds ? (
        <ThresholdsEditor
          key={thresholds.map((th) => th.days).join(',')}
          thresholds={thresholds}
        />
      ) : (
        <Card padding="lg">{t('admin_loading')}</Card>
      )}
    </div>
  );
}

/**
 * Thresholds editor. `days` initializes from the loaded thresholds at mount
 * (keyed by the parent), so there's no props→state sync effect.
 */
function ThresholdsEditor({ thresholds }: { thresholds: GameStreakThreshold[] }) {
  const t = useTranslations('comunidadEstrategica');
  const updateThresholds = useUpdateStreakThresholds();

  const [days, setDays] = useState<number[]>(
    thresholds.map((th) => th.days).sort((a, b) => a - b)
  );
  const [newDay, setNewDay] = useState('');

  const addDay = () => {
    const v = Number(newDay);
    if (!Number.isInteger(v) || v <= 0) {
      toast.error(t('admin_threshold_invalid'));
      return;
    }
    if (!days.includes(v)) setDays((d) => [...d, v].sort((a, b) => a - b));
    setNewDay('');
  };

  const removeDay = (v: number) => setDays((d) => d.filter((x) => x !== v));

  const saveThresholds = async () => {
    try {
      await updateThresholds.mutateAsync({ days });
      toast.success(t('admin_saved'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
        {t('admin_streak_thresholds')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {days.map((d) => (
          <span
            key={d}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-3 py-1 text-sm font-medium text-[var(--color-brand-gold)]"
          >
            {t('admin_threshold_days', { days: d })}
            <button type="button" onClick={() => removeDay(d)} aria-label={t('admin_remove')} title={t('admin_remove')}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={newDay}
          onChange={(e) => setNewDay(e.target.value)}
          placeholder={t('admin_threshold_add_placeholder')}
          className="w-40 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
        <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={addDay}>
          {t('admin_add')}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button onClick={saveThresholds} loading={updateThresholds.isPending}>
          {t('admin_save')}
        </Button>
      </div>
    </Card>
  );
}
