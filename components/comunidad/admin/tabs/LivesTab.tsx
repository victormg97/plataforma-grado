'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Heart, Gauge, RefreshCw } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useGameSettings, type GameSettingsResponse } from '@/lib/hooks/useComunidad';
import { useUpdateGameSettings } from '@/lib/hooks/useComunidadAdmin';
import type { GameLivesRegenMode } from '@/lib/supabase/types';
import { ConfigCallout, ConfigSection, NumberField } from '../ui';

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

  const disabledCls = enabled ? '' : 'pointer-events-none opacity-50';

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('lives_intro_title')}>{t('lives_intro_desc')}</ConfigCallout>

      {/* Master switch */}
      <ConfigSection
        icon={<Heart className="size-4" />}
        title={t('lives_config_enabled')}
        description={t('lives_config_hint')}
        actions={<AppSwitch checked={enabled} onChange={setEnabled} label="" />}
      >
        <p className="text-xs text-[var(--color-text-muted)]">
          {enabled ? t('lives_enabled_note') : t('lives_disabled_note')}
        </p>
      </ConfigSection>

      {/* Amounts */}
      <ConfigSection
        icon={<Gauge className="size-4" />}
        title={t('lives_amounts_title')}
        description={t('lives_amounts_desc')}
        className={disabledCls}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label={t('lives_config_max')} value={max} onChange={setMax} min={1} hint={t('lives_max_hint')} />
          <NumberField label={t('lives_config_start')} value={start} onChange={setStart} min={0} hint={t('lives_start_hint')} />
        </div>
        <AppSwitch checked={block} onChange={setBlock} label={t('lives_config_block')} />
        <p className="text-xs text-[var(--color-text-muted)]">
          {block ? t('lives_block_note_on') : t('lives_block_note_off')}
        </p>
      </ConfigSection>

      {/* Regeneration */}
      <ConfigSection
        icon={<RefreshCw className="size-4" />}
        title={t('lives_regen_title')}
        description={t('lives_regen_desc')}
        className={disabledCls}
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
            <span className="text-xs text-[var(--color-text-muted)]">
              {mode === 'per_life' ? t('lives_mode_per_life_hint') : t('lives_mode_full_refill_hint')}
            </span>
          </label>
          <NumberField
            label={t('lives_config_regen_hours')}
            value={hours}
            onChange={setHours}
            min={0.1}
            step={0.5}
            hint={t('lives_regen_hours_hint')}
          />
        </div>
      </ConfigSection>

      <div className="flex justify-end">
        <Button onClick={onSave} loading={update.isPending}>
          {t('admin_save')}
        </Button>
      </div>
    </div>
  );
}
