'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useCreateBadge, useUpdateBadge, useAdminQuizSubjects } from '@/lib/hooks/useComunidadAdmin';
import { BADGE_CRITERIA_TYPES, type AdminBadge, type BadgeCriteria, type BadgePayload } from '@/lib/comunidad/badge';
import { BadgeImageUploader } from './BadgeImageUploader';

const ROLES = ['alumno', 'profesor', 'admin', 'lector'] as const;

/** Number field used inside criteria (count / days / score). */
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
      />
    </label>
  );
}

/**
 * Modal shell. Remounts the inner form via `key` whenever the target badge (or
 * the create/edit mode) changes, so the form state initializes from props
 * without a props→state sync effect.
 */
export function BadgeFormModal({
  open,
  onClose,
  badge,
}: {
  open: boolean;
  onClose: () => void;
  badge: AdminBadge | null;
}) {
  const t = useTranslations('comunidadEstrategica');

  return (
    <Modal open={open} onClose={onClose} title={badge ? t('badge_edit') : t('badge_create')} size="lg">
      <BadgeFormFields key={badge?.id ?? 'new'} badge={badge} onClose={onClose} />
    </Modal>
  );
}

/** Inner form. State is derived from `badge` at mount (initializers), no effect. */
function BadgeFormFields({ badge, onClose }: { badge: AdminBadge | null; onClose: () => void }) {
  const t = useTranslations('comunidadEstrategica');
  const create = useCreateBadge();
  const update = useUpdateBadge();
  const { data: subjects } = useAdminQuizSubjects();

  const c = badge?.criteria ?? null;

  const [name, setName] = useState(badge?.name ?? '');
  const [description, setDescription] = useState(badge?.description ?? '');
  const [imagePath, setImagePath] = useState<string | null>(badge?.image_path ?? null);
  const [audience, setAudience] = useState<string[]>(
    badge?.audience.length ? badge.audience : ['alumno']
  );
  const [unlockType, setUnlockType] = useState<'automatic' | 'manual'>(badge?.unlock_type ?? 'automatic');
  const [criteriaType, setCriteriaType] = useState<BadgeCriteria['type']>(c?.type ?? 'streak_reached');
  const [num, setNum] = useState<number>(
    c?.type === 'streak_reached' ? c.days
      : c?.type === 'subject_max_score' ? c.score
      : c && 'count' in c ? c.count
      : 1
  );
  const [subjectId, setSubjectId] = useState(c?.type === 'subject_max_score' ? c.subject : '');
  const [seriesKey, setSeriesKey] = useState(badge?.series_key ?? '');
  const [seriesOrder, setSeriesOrder] = useState<number | ''>(badge?.series_order ?? '');
  const [hideCriteria, setHideCriteria] = useState(badge?.hide_criteria ?? false);
  const [enabled, setEnabled] = useState(badge?.enabled ?? true);

  const buildCriteria = (): BadgeCriteria | null => {
    if (unlockType !== 'automatic') return null;
    switch (criteriaType) {
      case 'streak_reached':
        return { type: 'streak_reached', days: num };
      case 'quiz_completed_count':
        return { type: 'quiz_completed_count', count: num };
      case 'weekly_case_count':
        return { type: 'weekly_case_count', count: num };
      case 'interrogacion_count':
        return { type: 'interrogacion_count', count: num };
      case 'subject_max_score':
        return { type: 'subject_max_score', subject: subjectId, score: num };
      case 'challenges_completed':
        return { type: 'challenges_completed', count: num };
      default:
        return null;
    }
  };

  const toggleRole = (role: string) =>
    setAudience((a) => (a.includes(role) ? a.filter((r) => r !== role) : [...a, role]));

  const onSave = async () => {
    // subject_max_score needs an explicit subject (Req. 3.1).
    if (unlockType === 'automatic' && criteriaType === 'subject_max_score' && !subjectId) {
      toast.error(t('badge_subject_required'));
      return;
    }

    const payload: BadgePayload & { id?: string } = {
      name,
      description: description || null,
      image_path: imagePath,
      audience: audience as BadgePayload['audience'],
      unlock_type: unlockType,
      criteria: buildCriteria(),
      series_key: seriesKey || null,
      series_order: seriesKey ? (seriesOrder === '' ? null : Number(seriesOrder)) : null,
      hide_criteria: hideCriteria,
      enabled,
    };

    try {
      if (badge) await update.mutateAsync({ ...payload, id: badge.id });
      else await create.mutateAsync(payload);
      toast.success(t('admin_saved'));
      onClose();
    } catch (e) {
      const code = (e as { message?: string })?.message;
      if (code === 'NOMBRE_REQUERIDO') toast.error(t('badge_name_required'));
      else if (code === 'CRITERIA_REQUIRED') toast.error(t('badge_criteria_required'));
      else if (code === 'SERIES_ORDER_REQUIRED') toast.error(t('badge_series_order_required'));
      else toast.error(t('admin_error'));
    }
  };

  const numLabel =
    criteriaType === 'streak_reached'
      ? t('badge_criteria_field_days')
      : criteriaType === 'subject_max_score'
      ? t('badge_criteria_field_score')
      : t('badge_criteria_field_count');

  return (
    <div className="flex flex-col gap-4">
      <BadgeImageUploader imagePath={imagePath} onUploaded={setImagePath} />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_name')}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_description')}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
      </label>

      <div>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_audience')}</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRole(r)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                audience.includes(r)
                  ? 'bg-[var(--color-brand-gold)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              {t(`rol_${r}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_unlock')}</span>
        <AppSelect
          value={unlockType}
          onChange={(v) => setUnlockType(v as 'automatic' | 'manual')}
          options={[
            { value: 'automatic', label: t('badge_unlock_automatic') },
            { value: 'manual', label: t('badge_unlock_manual') },
          ]}
        />
      </label>

      {unlockType === 'automatic' && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_criteria_type')}</span>
              <AppSelect
                value={criteriaType}
                onChange={(v) => setCriteriaType(v as BadgeCriteria['type'])}
                options={BADGE_CRITERIA_TYPES.map((ct) => ({ value: ct, label: t(`badge_criteria_type_${ct}`) }))}
              />
            </label>
            <NumField label={numLabel} value={num} onChange={setNum} />
          </div>

          {criteriaType === 'subject_max_score' && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_subject')}</span>
              <AppSelect
                value={subjectId}
                onChange={setSubjectId}
                placeholder={t('badge_field_subject_placeholder')}
                options={(subjects ?? []).map((s) => ({ value: s.subject_id, label: s.name }))}
              />
              <span className="text-xs text-[var(--color-text-muted)]">{t('badge_field_subject_hint')}</span>
            </label>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_series_key')}</span>
          <input
            type="text"
            value={seriesKey}
            onChange={(e) => setSeriesKey(e.target.value)}
            placeholder={t('badge_field_series_key_placeholder')}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>
        {seriesKey && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('badge_field_series_order')}</span>
            <input
              type="number"
              min={1}
              value={seriesOrder}
              onChange={(e) => setSeriesOrder(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </label>
        )}
      </div>

      <AppSwitch checked={hideCriteria} onChange={setHideCriteria} label={t('badge_field_hide_criteria')} />
      <AppSwitch checked={enabled} onChange={setEnabled} label={t('admin_enabled')} />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>{t('admin_cancel')}</Button>
        <Button onClick={onSave} loading={create.isPending || update.isPending}>{t('admin_save')}</Button>
      </div>
    </div>
  );
}
