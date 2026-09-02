'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gamepad2, Flame, Heart, Pencil } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { NicknameForm } from './NicknameForm';
import type { GameSettingsResponse } from '@/lib/hooks/useComunidad';

/**
 * Dark burgundy header bar used across the mini-app (mockup 2).
 *
 * The streak is real (Slice 1). "Vidas" (lives) and "Nivel" (level) are
 * VISUAL PLACEHOLDERS for later slices — they render with a muted "Pronto"
 * treatment and carry no logic. currentStreak is the only live value.
 */
export function GameHeader({
  settings,
  nickname,
  currentStreak,
}: {
  settings?: GameSettingsResponse;
  nickname: string | null;
  currentStreak: number;
}) {
  const t = useTranslations('comunidadEstrategica');
  const [editOpen, setEditOpen] = useState(false);

  return (
    <header className="rounded-[var(--game-radius)] bg-[var(--game-header-bg)] px-5 py-4 text-[var(--game-on-accent)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Gamepad2 className="mt-0.5 size-7 shrink-0 opacity-90" />
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {settings?.display_name || t('title')}
            </h1>
            <p className="max-w-md text-xs text-white/70">{t('header_tagline')}</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Streak — real */}
          <div className="flex items-center gap-2">
            <Flame className="size-6 text-[var(--game-flame)]" />
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-white/70">
                {t('streak_current')}
              </div>
              <div className="text-sm font-bold">
                {t('header_streak_days', { days: currentStreak })}
              </div>
            </div>
          </div>

          {/* Lives — visual placeholder (later slice) */}
          <div className="flex items-center gap-2 opacity-70" title={t('coming_soon_desc')}>
            <Heart className="size-6 text-[#e57373]" />
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-white/70">
                {t('lives_label')}
              </div>
              <div className="text-sm font-bold">
                — <span className="text-[10px] font-medium">{t('coming_soon_tag')}</span>
              </div>
            </div>
          </div>

          {/* Player + level — nickname real (editable), level placeholder */}
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
              {(nickname ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold">{nickname ?? t('player_anon')}</span>
                {nickname && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    aria-label={t('nickname_edit')}
                    title={t('nickname_edit')}
                    className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="text-[11px] text-white/70">
                {t('level_label')} — <span className="text-[10px]">{t('coming_soon_tag')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('nickname_edit')}>
        <NicknameForm
          initialValue={nickname ?? ''}
          submitLabel={t('nickname_save')}
          onSaved={() => setEditOpen(false)}
        />
      </Modal>
    </header>
  );
}
