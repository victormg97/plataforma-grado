import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { usePublishResolution } from '@/lib/hooks/useComunidadAdmin';
import type { GameWeeklyCase } from '@/lib/supabase/types';

/**
 * Publishes the commented resolution of a closed case (closed -> resolved).
 * Remounts inner fields via key; state initialized directly from props.
 */
export function ResolutionModal({
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
    <Modal open={open} onClose={onClose} title={t('weekly_case_publish_resolution')}>
      {caseItem && <ResolutionFields key={caseItem.id} caseItem={caseItem} onClose={onClose} />}
    </Modal>
  );
}

function ResolutionFields({
  caseItem,
  onClose,
}: {
  caseItem: GameWeeklyCase;
  onClose: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const publish = usePublishResolution();

  const [content, setContent] = useState(caseItem.resolution_content ?? '');
  const [visibility, setVisibility] = useState<'participants_only' | 'all_users'>(
    caseItem.resolution_visibility ?? 'participants_only'
  );

  const onSave = async () => {
    try {
      await publish.mutateAsync({
        case_id: caseItem.id,
        resolution_content: content,
        resolution_visibility: visibility,
      });
      toast.success(t('weekly_case_resolution_published'));
      onClose();
    } catch (e) {
      const code = (e as { message?: string })?.message;
      if (code === 'CASE_NOT_CLOSED') toast.error(t('weekly_case_error_not_closed'));
      else if (code === 'EMPTY_RESOLUTION') toast.error(t('weekly_case_error_empty_resolution'));
      else toast.error(t('admin_error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{t('weekly_case_resolution_content')}</span>
        <RichTextEditor content={content} onChange={setContent} placeholder={t('weekly_case_resolution_placeholder')} />
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

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>{t('admin_cancel')}</Button>
        <Button onClick={onSave} loading={publish.isPending}>{t('weekly_case_publish')}</Button>
      </div>
    </div>
  );
}
