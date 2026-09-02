'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Image from 'next/image';
import { ImageIcon, Trash2, Eye, Type, Image as ImageLucide, Trophy, Award } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { useGameSettings, type GameSettingsResponse } from '@/lib/hooks/useComunidad';
import {
  useUpdateGameSettings,
  useUploadHeroImage,
  useDeleteHeroImage,
} from '@/lib/hooks/useComunidadAdmin';
import { heroImageUrl } from '@/components/comunidad/heroImageUrl';
import { HERO_IMAGE_ACCEPTED_EXT } from '@/lib/comunidad/game-config';
import type { GameSettings } from '@/lib/supabase/types';
import { ConfigCallout, ConfigSection, TextField, NumberField } from '../ui';

/**
 * General config tab. Waits for settings, then mounts the form (keyed by the
 * settings row) so its state initializes from the loaded data without a
 * props→state sync effect.
 */
export function GeneralTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data: settings, isLoading } = useGameSettings();

  if (isLoading || !settings) {
    return <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>;
  }

  return <GeneralForm key={settings.tenant} settings={settings} />;
}

// The API returns the full game_settings row; the query type is a subset, so
// we read the extra admin-only columns via this widened shape.
type FullSettings = GameSettingsResponse & Partial<GameSettings>;

function GeneralForm({ settings }: { settings: GameSettingsResponse }) {
  const t = useTranslations('comunidadEstrategica');
  const update = useUpdateGameSettings();
  const uploadHero = useUploadHeroImage();
  const deleteHero = useDeleteHeroImage();
  const heroInputRef = useRef<HTMLInputElement>(null);
  const initial = settings as FullSettings;

  const [form, setForm] = useState<FullSettings>(initial);

  const set = <K extends keyof FullSettings>(key: K, value: FullSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const heroUrl = heroImageUrl(form.hero_image_path);

  const onHeroFile = async (file: File) => {
    try {
      const res = await uploadHero.mutateAsync(file);
      set('hero_image_path', res.image_path as never);
      toast.success(t('admin_saved'));
    } catch (e) {
      const code = (e as { message?: string })?.message;
      if (code === 'INVALID_FORMAT') toast.error(t('hero_image_error_format'));
      else if (code === 'TOO_LARGE') toast.error(t('hero_image_error_size'));
      else toast.error(t('admin_error'));
    }
  };

  const onHeroDelete = async () => {
    try {
      await deleteHero.mutateAsync();
      set('hero_image_path', null as never);
      toast.success(t('admin_deleted'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

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
        recent_achievements_count: form.recent_achievements_count,
      });
      toast.success(t('admin_saved'));
    } catch {
      toast.error(t('admin_error'));
    }
  };

  const isAdminOnly = (form.game_visibility ?? 'admin_only') === 'admin_only';

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('general_intro_title')}>{t('general_intro_desc')}</ConfigCallout>

      {/* Visibility + identity */}
      <ConfigSection
        icon={<Eye className="size-4" />}
        title={t('general_visibility_title')}
        description={t('general_visibility_desc')}
      >
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
            <span className="text-xs text-[var(--color-text-muted)]">
              {isAdminOnly ? t('general_visibility_hint_admin') : t('general_visibility_hint_all')}
            </span>
          </label>
          <TextField
            label={t('admin_display_name')}
            value={(form.display_name as string) ?? ''}
            onChange={(v) => set('display_name', v as never)}
            hint={t('general_display_name_hint')}
          />
        </div>
      </ConfigSection>

      {/* Section names */}
      <ConfigSection
        icon={<Type className="size-4" />}
        title={t('admin_section_names')}
        description={t('general_section_names_desc')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('nav_daily')} value={(form.section_name_daily_question as string) ?? ''} onChange={(v) => set('section_name_daily_question', v as never)} />
          <TextField label={t('nav_streak')} value={(form.section_name_streak as string) ?? ''} onChange={(v) => set('section_name_streak', v as never)} />
          <TextField label={t('nav_ranking')} value={(form.section_name_ranking as string) ?? ''} onChange={(v) => set('section_name_ranking', v as never)} />
          <TextField label={t('nav_challenges')} value={(form.section_name_challenges as string) ?? ''} onChange={(v) => set('section_name_challenges', v as never)} />
          <TextField label={t('nav_badges')} value={(form.section_name_badges as string) ?? ''} onChange={(v) => set('section_name_badges', v as never)} />
          <TextField label={t('nav_weekly_case')} value={(form.section_name_weekly_case as string) ?? ''} onChange={(v) => set('section_name_weekly_case', v as never)} />
        </div>
      </ConfigSection>

      {/* Hero image */}
      <ConfigSection
        icon={<ImageLucide className="size-4" />}
        title={t('hero_image_title')}
        description={t('hero_image_hint')}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {heroUrl ? (
              <Image
                src={heroUrl}
                alt={t('hero_image_preview_alt')}
                width={160}
                height={96}
                className="h-full w-full object-contain"
                unoptimized
              />
            ) : (
              <ImageIcon className="size-8 text-[var(--color-text-muted)]" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={heroInputRef}
              type="file"
              accept={HERO_IMAGE_ACCEPTED_EXT.join(',')}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onHeroFile(f);
                e.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              onClick={() => heroInputRef.current?.click()}
              loading={uploadHero.isPending}
            >
              {t('hero_image_upload')}
            </Button>
            {form.hero_image_path && (
              <Button
                variant="ghost"
                icon={<Trash2 className="size-4" />}
                onClick={onHeroDelete}
                loading={deleteHero.isPending}
              >
                {t('hero_image_remove')}
              </Button>
            )}
          </div>
        </div>
      </ConfigSection>

      {/* Recent achievements */}
      <ConfigSection
        icon={<Trophy className="size-4" />}
        title={t('achievements_config_title')}
        description={t('general_achievements_desc')}
      >
        <NumberField
          label={t('achievements_config_count')}
          value={form.recent_achievements_count ?? 3}
          onChange={(v) => set('recent_achievements_count', v as never)}
          min={1}
          className="max-w-xs"
        />
      </ConfigSection>

      {/* Badge image validation */}
      <ConfigSection
        icon={<Award className="size-4" />}
        title={t('admin_badge_image_config')}
        description={t('general_badge_image_desc')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label={t('admin_badge_max_bytes')}
            value={form.badge_image_max_bytes ?? 2097152}
            onChange={(v) => set('badge_image_max_bytes', v as never)}
            min={1}
            hint={t('general_badge_max_bytes_hint')}
          />
          <NumberField
            label={t('admin_badge_recommended_px')}
            value={form.badge_image_recommended_px ?? 512}
            onChange={(v) => set('badge_image_recommended_px', v as never)}
            min={1}
            hint={t('general_badge_px_hint')}
          />
        </div>
      </ConfigSection>

      {/* Sticky-ish save bar */}
      <div className="flex justify-end">
        <Button onClick={onSave} loading={update.isPending}>
          {t('admin_save')}
        </Button>
      </div>
    </div>
  );
}
