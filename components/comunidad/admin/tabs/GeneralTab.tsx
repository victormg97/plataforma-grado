'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { useGameSettings, type GameSettingsResponse } from '@/lib/hooks/useComunidad';
import { useUpdateGameSettings } from '@/lib/hooks/useComunidadAdmin';
import type { GameSettings } from '@/lib/supabase/types';

/**
 * General config tab. Waits for settings, then mounts the form (keyed by the
 * settings row) so its state initializes from the loaded data without a
 * props→state sync effect.
 */
export function GeneralTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data: settings, isLoading } = useGameSettings();

  if (isLoading || !settings) {
    return <Card padding="lg">{t('admin_loading')}</Card>;
  }

  return <GeneralForm key={settings.tenant} settings={settings} />;
}

// The API returns the full game_settings row; the query type is a subset, so
// we read the extra admin-only columns via this widened shape.
type FullSettings = GameSettingsResponse & Partial<GameSettings>;

function GeneralForm({ settings }: { settings: GameSettingsResponse }) {
  const t = useTranslations('comunidadEstrategica');
  const update = useUpdateGameSettings();
  const initial = settings as FullSettings;

  const [form, setForm] = useState<FullSettings>(initial);

  const set = <K extends keyof FullSettings>(key: K, value: FullSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = async () => {
    try {
      await update.mutateAsync({
        game_visibility: form.game_visibility,
        display_name: form.display_name,
        section_name_daily_question: form.section_name_daily_question,
        section_name_streak: form.section_name_streak,
        section_name_ranking: form.section_name_ranking,
        section_name_challenges: form.section_name_challenges,
        section_name_badges: form.section_name_badges,
        section_name_weekly_case: form.section_name_weekly_case,
        badge_image_max_bytes: form.badge_image_max_bytes,
        badge_image_recommended_px: form.badge_image_recommended_px,
      });
      toast.success(t('admin_saved'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  const field = (label: string, key: keyof FullSettings) => (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <input
        type="text"
        value={(form[key] as string) ?? ''}
        onChange={(e) => set(key, e.target.value as never)}
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
      />
    </label>
  );

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('admin_visibility')}
          </span>
          <AppSelect
            value={form.game_visibility ?? 'admin_only'}
            onChange={(v) => set('game_visibility', v as GameSettings['game_visibility'])}
            options={[
              { value: 'admin_only', label: t('admin_visibility_admin_only') },
              { value: 'all_users', label: t('admin_visibility_all_users') },
            ]}
          />
        </label>
        {field(t('admin_display_name'), 'display_name')}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('admin_section_names')}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(t('nav_daily'), 'section_name_daily_question')}
          {field(t('nav_streak'), 'section_name_streak')}
          {field(t('nav_ranking'), 'section_name_ranking')}
          {field(t('nav_challenges'), 'section_name_challenges')}
          {field(t('nav_badges'), 'section_name_badges')}
          {field(t('nav_weekly_case'), 'section_name_weekly_case')}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('admin_badge_image_config')}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('admin_badge_max_bytes')}
            </span>
            <input
              type="number"
              min={1}
              value={form.badge_image_max_bytes ?? 2097152}
              onChange={(e) => set('badge_image_max_bytes', Number(e.target.value) as never)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('admin_badge_recommended_px')}
            </span>
            <input
              type="number"
              min={1}
              value={form.badge_image_recommended_px ?? 512}
              onChange={(e) => set('badge_image_recommended_px', Number(e.target.value) as never)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} loading={update.isPending}>
          {t('admin_save')}
        </Button>
      </div>
    </Card>
  );
}
