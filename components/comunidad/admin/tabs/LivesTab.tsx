'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useGameSettings, type GameSettingsResponse } from '@/lib/hooks/useComunidad';
import { useUpdateGameSettings } from '@/lib/hooks/useComunidadAdmin';
import type { GameLivesRegenMode } from '@/lib/supabase/types';

/** Lives config tab: enable/disable and tune the lives system per tenant. */
export function LivesTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data: settings, isLoading } = useGameSettings();

  if (isLoading || !settings) {
    return <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>;
  }
  return <LivesForm key={settings.tenant} settings={settings} />;
}

function LivesForm({ settings }: { settings: GameSettingsResponse }) {
  const t = useTranslations('comunidadEstrategica');
  const update = useUpdateGameSettings();

  const [enabled, setEnabled] = useState(settings.lives_enabled ?? false);
  const [max, setMax] = useState<number>(settings.lives_max ?? 10);
  const [start, setStart] = useState<number>(settings.lives_start ?? 10);
  const [block, setBlock] = useState(settings.lives_block_when_empty ?? true);
  const [mode, setMode] = useState<GameLivesRegenMode>(settings.lives_regen_mode ?? 'per_life');
  const [hours, setHours] = useState<number>(Number(settings.lives_regen_hours ?? 1));

  const onSave = async () => {
    if (start > max) {
      toast.error(t('lives_error_start_gt_max'));
      return;
    }
    if (hours <= 0) {
      toast.error(t('lives_error_hours'));
      return;
    }
    try {
      await update.mutateAsync({
        lives_enabled: enabled,
        lives_max: max,
        lives_start: start,
        lives_block_when_empty: block,
        lives_regen_mode: mode,
        lives_regen_hours: hours,
      });
      toast.success(t('admin_saved'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  const numberField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    min: number,
    step = 1
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
      />
    </label>
  );

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <p className="text-sm text-[var(--color-text-muted)]">{t('lives_config_hint')}</p>

      <AppSwitch checked={enabled} onChange={setEnabled} label={t('lives_config_enabled')} />

      <div className={enabled ? '' : 'pointer-events-none opacity-50'}>
        <div className="grid gap-4 sm:grid-cols-2">
          {numberField(t('lives_config_max'), max, setMax, 1)}
          {numberField(t('lives_config_start'), start, setStart, 0)}
        </div>

        <div className="mt-4">
          <AppSwitch checked={block} onChange={setBlock} label={t('lives_config_block')} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('lives_config_mode')}
            </span>
            <AppSelect
              value={mode}
              onChange={(v) => setMode(v as GameLivesRegenMode)}
              options={[
                { value: 'per_life', label: t('lives_mode_per_life') },
                { value: 'full_refill', label: t('lives_mode_full_refill') },
              ]}
            />
          </label>
          {numberField(t('lives_config_regen_hours'), hours, setHours, 0.1, 0.5)}
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {mode === 'per_life' ? t('lives_mode_per_life_hint') : t('lives_mode_full_refill_hint')}
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} loading={update.isPending}>
          {t('admin_save')}
        </Button>
      </div>
    </Card>
  );
}
