import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { useCreateWeeklyCase, useUpdateWeeklyCase } from '@/lib/hooks/useComunidadAdmin';
import type { GameWeeklyCase } from '@/lib/supabase/types';
import type { WeeklyCasePayload } from '@/lib/comunidad/weekly-case';

/** ISO string -> value for <input type="datetime-local"> (local wall clock). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** datetime-local value -> ISO string with offset. */
function toIso(local: string): string {
  return new Date(local).toISOString();
}

/**
 * Modal shell. Remounts the inner form via `key` on case/mode change so the
 * form state initializes from props without a props->state sync effect
 * (Slice 3 convention).
 */
export function WeeklyCaseFormModal({
  open,
  onClose,
  caseItem,
}: {
  open: boolean;
  onClose: () => void;
  caseItem: GameWeeklyCase | null;
}) {
  const t = useTranslations('comunidadEstrategica');

  return (
    <Modal open={open} onClose={onClose} title={caseItem ? t('weekly_case_edit') : t('weekly_case_create')}>
      <WeeklyCaseFormFields key={caseItem?.id ?? 'new'} caseItem={caseItem} onClose={onClose} />
    </Modal>
  );
}

/** Inner form. State derived from `caseItem` at mount (initializers), no effect. */
function WeeklyCaseFormFields({
  caseItem,
  onClose,
}: {
  caseItem: GameWeeklyCase | null;
  onClose: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const create = useCreateWeeklyCase();
  const update = useUpdateWeeklyCase();

  const [title, setTitle] = useState(caseItem?.title ?? '');
  const [content, setContent] = useState(caseItem?.content ?? '');
  const [windowStart, setWindowStart] = useState(toLocalInput(caseItem?.window_start ?? null));
  const [windowEnd, setWindowEnd] = useState(toLocalInput(caseItem?.window_end ?? null));
  const [status, setStatus] = useState<'draft' | 'open'>(
    caseItem?.status === 'open' ? 'open' : 'draft'
  );
  const [visibility, setVisibility] = useState<'participants_only' | 'all_users'>(
    caseItem?.resolution_visibility ?? 'participants_only'
  );

  const onSave = async () => {
    if (!windowStart || !windowEnd) {
      toast.error(t('weekly_case_error_window_required'));
      return;
    }
    const payload: WeeklyCasePayload & { id?: string } = {
      title,
      content,
      window_start: toIso(windowStart),
      window_end: toIso(windowEnd),
      status,
      resolution_visibility: visibility,
    };

    try {
      if (caseItem) {
        await update.mutateAsync({ ...payload, id: caseItem.id });
      } else {
        await create.mutateAsync(payload);
      }
      toast.success(t('admin_saved'));
      onClose();
    } catch (e) {
      const code = (e as { message?: string })?.message;
      if (code === 'WINDOW_END_AFTER_START') toast.error(t('weekly_case_error_window_order'));
      else if (code === 'TITULO_REQUERIDO') toast.error(t('weekly_case_error_title'));
      else if (code === 'CONTENIDO_REQUERIDO') toast.error(t('weekly_case_error_content'));
      else toast.error(t('admin_error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('weekly_case_field_title')}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('weekly_case_field_content')}</span>
        <RichTextEditor content={content} onChange={setContent} placeholder={t('weekly_case_content_placeholder')} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('weekly_case_field_window_start')}</span>
          <input
            type="datetime-local"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('weekly_case_field_window_end')}</span>
          <input
            type="datetime-local"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('weekly_case_field_status')}</span>
          <AppSelect
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: 'draft', label: t('weekly_case_status_draft') },
              { value: 'open', label: t('weekly_case_status_open') },
            ]}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('weekly_case_field_visibility')}</span>
          <AppSelect
            value={visibility}
            onChange={(v) => setVisibility(v as typeof visibility)}
            options={[
              { value: 'participants_only', label: t('weekly_case_visibility_participants_only') },
              { value: 'all_users', label: t('weekly_case_visibility_all_users') },
            ]}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>{t('admin_cancel')}</Button>
        <Button onClick={onSave} loading={create.isPending || update.isPending}>{t('admin_save')}</Button>
      </div>
    </div>
  );
}
