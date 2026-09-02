'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useCreateChallenge, useUpdateChallenge } from '@/lib/hooks/useComunidadAdmin';
import type { GameChallenge } from '@/lib/supabase/types';
import type { ChallengePayload } from '@/lib/comunidad/admin';

const ACTION_TYPES = [
  'quiz_completed',
  'daily_question_answered',
  'interrogacion_completed',
  'weekly_case_participated',
  'study_hours_logged',
] as const;

type CriteriaShape = { action_type: string; count: number; category?: string | null };

/**
 * Modal shell. Remounts the inner form via `key` on challenge/mode change so
 * the form state initializes from props without a props→state sync effect.
 */
export function ChallengeFormModal({
  open,
  onClose,
  challenge,
}: {
  open: boolean;
  onClose: () => void;
  challenge: GameChallenge | null;
}) {
  const t = useTranslations('comunidadEstrategica');

  return (
    <Modal open={open} onClose={onClose} title={challenge ? t('challenge_edit') : t('challenge_create')}>
      <ChallengeFormFields key={challenge?.id ?? 'new'} challenge={challenge} onClose={onClose} />
    </Modal>
  );
}

/** Inner form. State derived from `challenge` at mount (initializers), no effect. */
function ChallengeFormFields({
  challenge,
  onClose,
}: {
  challenge: GameChallenge | null;
  onClose: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const create = useCreateChallenge();
  const update = useUpdateChallenge();

  const crit = (challenge?.criteria ?? {}) as CriteriaShape;

  const [title, setTitle] = useState(challenge?.title ?? '');
  const [description, setDescription] = useState(challenge?.description ?? '');
  const [actionType, setActionType] = useState<string>(crit.action_type ?? 'quiz_completed');
  const [count, setCount] = useState<number>(Number(crit.count) || 1);
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'custom'>(
    challenge?.period_type ?? 'weekly'
  );
  const [startsAt, setStartsAt] = useState(challenge?.starts_at ? challenge.starts_at.slice(0, 16) : '');
  const [endsAt, setEndsAt] = useState(challenge?.ends_at ? challenge.ends_at.slice(0, 16) : '');
  const [enabled, setEnabled] = useState(challenge?.enabled ?? true);

  const onSave = async () => {
    const payload: ChallengePayload & { id?: string } = {
      title,
      description: description || null,
      criteria: { action_type: actionType as ChallengePayload['criteria']['action_type'], count },
      period_type: periodType,
      starts_at: periodType === 'custom' && startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: periodType === 'custom' && endsAt ? new Date(endsAt).toISOString() : null,
      enabled,
    };

    try {
      if (challenge) {
        await update.mutateAsync({ ...payload, id: challenge.id });
      } else {
        await create.mutateAsync(payload);
      }
      toast.success(t('admin_saved'));
      onClose();
    } catch (e) {
      const code = (e as { message?: string })?.message;
      if (code === 'CUSTOM_WINDOW_REQUIRED') toast.error(t('challenge_custom_window_required'));
      else if (code === 'TITULO_REQUERIDO') toast.error(t('challenge_title_required'));
      else toast.error(t('admin_error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('challenge_field_title')}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('challenge_field_description')}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('challenge_field_action')}</span>
          <AppSelect
            value={actionType}
            onChange={setActionType}
            options={ACTION_TYPES.map((a) => ({ value: a, label: t(`action_${a}`) }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('challenge_field_count')}</span>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('challenge_field_period')}</span>
        <AppSelect
          value={periodType}
          onChange={(v) => setPeriodType(v as typeof periodType)}
          options={[
            { value: 'weekly', label: t('challenge_period_weekly') },
            { value: 'monthly', label: t('challenge_period_monthly') },
            { value: 'custom', label: t('challenge_period_custom') },
          ]}
        />
      </label>

      {periodType === 'custom' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('challenge_field_starts')}</span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('challenge_field_ends')}</span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </label>
        </div>
      )}

      <AppSwitch checked={enabled} onChange={setEnabled} label={t('admin_enabled')} />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>{t('admin_cancel')}</Button>
        <Button onClick={onSave} loading={create.isPending || update.isPending}>{t('admin_save')}</Button>
      </div>
    </div>
  );
}
