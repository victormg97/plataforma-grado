'use client';
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';
import { Search, Ban, ShieldOff, Shield, Heart, RotateCcw, Users, ClipboardList } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAdminPlayers, usePlayerAction, useCasePendingCounts } from '@/lib/hooks/useComunidadAdmin';
import type { GamePlayer } from '@/lib/comunidad/game-config';
import { ConfigCallout, ConfigListHeader, ConfigEmptyState } from '../ui';

/** Players tab: search + moderate players (restrict, ban, lives, reset level). */
export function PlayersTab() {
  const t = useTranslations('comunidadEstrategica');
  const [query, setQuery] = useState('');
  const q = useDebounce(query, 300);
  const { data, isLoading, isError, refetch } = useAdminPlayers(q);

  const players = data?.players ?? [];
  const { data: pending } = useCasePendingCounts();
  const pendingByUser = pending?.by_user ?? {};

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('players_intro_title')}>{t('players_intro_desc')}</ConfigCallout>

      <ConfigListHeader
        icon={<Users className="size-4" />}
        title={t('players_list_title')}
        description={t('players_list_desc')}
        count={players.length}
      />

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('players_search_placeholder')}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] py-2 pl-10 pr-3 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
      </label>

      {isError ? (
        <Card padding="lg" className="flex flex-col items-center gap-3 text-center" role="alert">
          <p className="text-sm text-[var(--color-error)]">{t('error_loading')}</p>
          <Button variant="secondary" onClick={() => refetch()}>{t('error_retry')}</Button>
        </Card>
      ) : isLoading ? (
        <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>
      ) : players.length === 0 ? (
        <ConfigEmptyState icon={<Users className="size-8" />} message={t('players_empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {players.map((p) => (
            <PlayerRow key={p.user_id} player={p} pendingCases={pendingByUser[p.user_id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: 'danger' | 'warning'; children: React.ReactNode }) {
  const cls =
    tone === 'danger'
      ? 'bg-[var(--color-error)]/12 text-[var(--color-error)]'
      : 'bg-[var(--color-warning,#b45309)]/12 text-[var(--color-warning,#b45309)]';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

type ConfirmKind = 'restrict' | 'unrestrict' | 'reset_level' | null;

function PlayerRow({ player, pendingCases }: { player: GamePlayer; pendingCases: number }) {
  const t = useTranslations('comunidadEstrategica');
  const action = usePlayerAction();
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [livesOpen, setLivesOpen] = useState(false);
  const [livesValue, setLivesValue] = useState(player.current_lives ?? 0);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const displayName =
    player.nickname ||
    [player.nombre, player.apellido].filter(Boolean).join(' ') ||
    player.email ||
    player.user_id;

  const run = async (fn: () => Promise<unknown>, onDone?: () => void) => {
    try {
      await fn();
      toast.success(t('admin_saved'));
      onDone?.();
    } catch {
      toast.error(t('admin_error'));
    }
  };

  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--color-text-primary)]">{displayName}</span>
            {player.is_banned && <StatusBadge tone="danger">{t('players_status_banned')}</StatusBadge>}
            {player.is_restricted && (
              <StatusBadge tone="warning">{t('players_status_restricted')}</StatusBadge>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {t('players_meta', {
              level: player.level,
              xp: player.xp,
              lives: player.current_lives ?? 0,
              streak: player.current_streak ?? 0,
            })}
          </p>
          {player.is_banned && player.ban_reason && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t('banned_reason_label')}: {player.ban_reason}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {player.is_restricted ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<ShieldOff className="size-4" />}
            onClick={() => setConfirm('unrestrict')}
          >
            {t('players_action_unrestrict')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon={<Shield className="size-4" />}
            onClick={() => setConfirm('restrict')}
          >
            {t('players_action_restrict')}
          </Button>
        )}

        {player.is_banned ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Ban className="size-4" />}
            loading={action.isPending}
            onClick={() => run(() => action.mutateAsync({ action: 'unban', user_id: player.user_id }))}
          >
            {t('players_action_unban')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="danger"
            icon={<Ban className="size-4" />}
            onClick={() => {
              setBanReason('');
              setBanOpen(true);
            }}
          >
            {t('players_action_ban')}
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          icon={<Heart className="size-4" />}
          onClick={() => {
            setLivesValue(player.current_lives ?? 0);
            setLivesOpen(true);
          }}
        >
          {t('players_action_set_lives')}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw className="size-4" />}
          onClick={() => setConfirm('reset_level')}
        >
          {t('players_action_reset_level')}
        </Button>

        <Link
          href={`/admin/comunidad/casos?user=${player.user_id}`}
          className="relative inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <span className="size-4"><ClipboardList className="size-4" /></span>
          {t('players_action_review_cases')}
          {pendingCases > 0 && (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--color-error)] px-1 text-[10px] font-bold leading-4 text-white">
              {pendingCases}
            </span>
          )}
        </Link>
      </div>

      <Modal
        open={banOpen}
        onClose={() => setBanOpen(false)}
        title={t('players_ban_modal_title')}
        description={t('players_ban_modal_desc')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBanOpen(false)}>
              {t('admin_cancel')}
            </Button>
            <Button
              variant="danger"
              loading={action.isPending}
              onClick={() =>
                run(
                  () =>
                    action.mutateAsync({
                      action: 'ban',
                      user_id: player.user_id,
                      reason: banReason.trim() || null,
                    }),
                  () => setBanOpen(false)
                )
              }
            >
              {t('players_action_ban')}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('players_ban_reason_label')}
          </span>
          <textarea
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t('players_ban_reason_placeholder')}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>
      </Modal>

      <Modal
        open={livesOpen}
        onClose={() => setLivesOpen(false)}
        title={t('players_lives_modal_title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLivesOpen(false)}>
              {t('admin_cancel')}
            </Button>
            <Button
              loading={action.isPending}
              onClick={() =>
                run(
                  () =>
                    action.mutateAsync({
                      action: 'set_lives',
                      user_id: player.user_id,
                      lives: livesValue,
                    }),
                  () => setLivesOpen(false)
                )
              }
            >
              {t('admin_save')}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('players_lives_modal_label')}
          </span>
          <input
            type="number"
            min={0}
            value={livesValue}
            onChange={(e) => setLivesValue(Number(e.target.value))}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>
      </Modal>

      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        loading={action.isPending}
        isDanger={confirm === 'reset_level'}
        title={
          confirm === 'reset_level'
            ? t('players_confirm_reset_title')
            : confirm === 'restrict'
              ? t('players_confirm_restrict_title')
              : t('players_confirm_unrestrict_title')
        }
        description={
          confirm === 'reset_level'
            ? t('players_confirm_reset_desc')
            : confirm === 'restrict'
              ? t('players_confirm_restrict_desc')
              : t('players_confirm_unrestrict_desc')
        }
        confirmText={t('admin_confirm')}
        cancelText={t('admin_cancel')}
        onConfirm={() => {
          const kind = confirm;
          if (!kind) return;
          run(() => action.mutateAsync({ action: kind, user_id: player.user_id }), () => setConfirm(null));
        }}
      />
    </Card>
  );
}
