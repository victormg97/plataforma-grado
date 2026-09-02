import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import { RichDescription } from '@/components/common/RichDescription';
import { useSubmitWeeklyCaseAnswer } from '@/lib/hooks/useComunidad';
import type { WeeklyCaseMyAnswer } from '@/lib/comunidad/weekly-case';

/**
 * Answer editor for an open weekly case. State is initialized directly from
 * props (no props->state effect); the parent remounts this by key when the
 * case changes. When the case is not open, renders the answer read-only.
 */
export function AnswerEditor({
  caseId,
  isOpen,
  myAnswer,
}: {
  caseId: string;
  isOpen: boolean;
  myAnswer: WeeklyCaseMyAnswer | null;
}) {
  const t = useTranslations('comunidadEstrategica');
  const submit = useSubmitWeeklyCaseAnswer();

  const [content, setContent] = useState(myAnswer?.answer_content ?? '');

  // Closed/resolved case: show the recorded answer read-only (Req. 5.2).
  if (!isOpen) {
    if (!myAnswer) {
      return (
        <p className="text-sm text-[var(--game-text-muted)]">
          {t('weekly_case_no_answer_closed')}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-[var(--game-text)]">
          {t('weekly_case_my_answer')}
        </h4>
        <RichDescription html={myAnswer.answer_content} className="text-[var(--game-text)]" />
      </div>
    );
  }

  const onSave = async () => {
    try {
      const res = await submit.mutateAsync({ case_id: caseId, answer_content: content });
      if (res.is_new && (res.points_awarded ?? 0) > 0) {
        toast.success(t('weekly_case_answer_points', { points: res.points_awarded ?? 0 }));
      } else {
        toast.success(t('weekly_case_answer_saved'));
      }
    } catch (e) {
      const code = (e as { message?: string })?.message;
      if (code === 'EMPTY_ANSWER') toast.error(t('weekly_case_error_empty_answer'));
      else if (code === 'CASE_CLOSED') toast.error(t('weekly_case_error_closed'));
      else if (code === 'CASE_NOT_AVAILABLE') toast.error(t('weekly_case_error_not_available'));
      else toast.error(t('weekly_case_error_generic'));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-[var(--game-text)]">
        {myAnswer ? t('weekly_case_edit_answer') : t('weekly_case_write_answer')}
      </h4>
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder={t('weekly_case_answer_placeholder')}
      />
      <button
        type="button"
        onClick={onSave}
        disabled={submit.isPending}
        className="w-fit rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)] disabled:opacity-50"
      >
        {submit.isPending
          ? t('weekly_case_saving')
          : myAnswer
            ? t('weekly_case_update')
            : t('weekly_case_send')}
      </button>
    </div>
  );
}
