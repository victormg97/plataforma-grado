'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gamepad2, Flame, Pencil } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { NicknameForm } from './NicknameForm';
import { LivesIndicator } from './LivesIndicator';
import type { GameSettingsResponse } from '@/lib/hooks/useComunidad';
import type { PlayerLives, PlayerLevel } from '@/lib/comunidad/game-config';

/**
 * Dark burgundy header bar used across the mini-app (mockup 2).
 * Streak, lives and level are all live. Lives only render when the lives
 * system is enabled for the tenant. Nickname is editable via a modal.
 */
export function GameHeader({
  settings,
  nickname,
  currentStreak,
  lives,
  level,
}: {
  settings?: GameSettingsResponse;
  nickname: string | null;
  currentStreak: number;
  lives?: PlayerLives;
  level?: PlayerLevel;
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

          {/* Lives — real, only when the lives system is enabled */}
          {lives?.enabled && <LivesIndicator lives={lives} />}

          {/* Player + level — both real; nickname editable */}
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
                {t('level_label')} {level?.level ?? 1}
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
