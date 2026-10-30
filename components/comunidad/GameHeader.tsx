'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gamepad2, Pencil } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { NicknameForm } from './NicknameForm';
import { LivesIndicator } from './LivesIndicator';
import { StreakIndicator } from './StreakIndicator';
import { useUserStore } from '@/stores/useUserStore';
import type { GameProfileResponse, GameSettingsResponse } from '@/lib/hooks/useComunidad';

/**
 * Dark burgundy header bar used across the mini-app (mockup 2).
 * Streak, lives and level are all live. Lives only render when the lives
 * system is enabled for the tenant. Nickname is editable via a modal.
 */
export function GameHeader({
  settings,
  profile,
}: {
  settings?: GameSettingsResponse;
  profile?: GameProfileResponse;
}) {
  const t = useTranslations('comunidadEstrategica');
  const [editOpen, setEditOpen] = useState(false);

  const userId = useUserStore((s) => s.user?.id ?? null);
  const nickname = profile?.nickname ?? null;
  const lives = profile?.lives;
  const level = profile?.level;

  return (
    // The header background is always a dark burgundy (every theme), so its
    // text is always white. (--game-on-accent is dark in the graduado theme.)
    <header className="rounded-[var(--game-radius)] bg-[var(--game-header-bg)] px-5 py-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex select-none items-start gap-3">
          <Gamepad2 className="mt-0.5 size-7 shrink-0 opacity-90" />
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {settings?.display_name || t('title')}
            </h1>
            <p className="max-w-md text-xs text-white/70">{t('header_tagline')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Streak — real, animated, with details popover */}
          <StreakIndicator
            currentStreak={profile?.current_streak ?? 0}
            longestStreak={profile?.longest_streak ?? 0}
            previousStreak={profile?.previous_streak ?? 0}
            status={profile?.streak_status ?? 'none'}
            lastActivityDate={profile?.last_activity_date ?? null}
            userId={userId}
          />

          {/* Lives — real, only when the lives system is enabled */}
          {lives?.enabled && (
            <LivesIndicator
              lives={lives}
              regenMode={settings?.lives_regen_mode}
              regenHours={settings?.lives_regen_hours}
            />
          )}

          {/* Player + level — nickname is selectable; level is not */}
          <div className="flex items-center gap-2">
            <div className="flex size-9 select-none items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
              {(nickname ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="select-text text-sm font-bold">{nickname ?? t('player_anon')}</span>
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
              <div className="select-none text-[11px] text-white/70">
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
