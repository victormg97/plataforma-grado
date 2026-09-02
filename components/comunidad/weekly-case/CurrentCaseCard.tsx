import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Card } from '@/components/common/Card';
import { RichDescription } from '@/components/common/RichDescription';
import { CaseStatusBadge } from './CaseStatusBadge';
import { AnswerEditor } from './AnswerEditor';
import { ResolutionPanel } from './ResolutionPanel';
import type { WeeklyCaseResult } from '@/lib/comunidad/weekly-case';

/**
 * Full card for the current (or latest) weekly case: statement + status +
 * window + answer editor (when open) + resolution (when visible).
 */
export function CurrentCaseCard({ data }: { data: WeeklyCaseResult }) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dfLocale = locale === 'en' ? enUS : esLocale;

  const c = data.case;
  if (!c) {
    return (
      <Card padding="lg" className="border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]">
        <p className="text-sm text-[var(--game-text-muted)]">{t('weekly_case_empty')}</p>
      </Card>
    );
  }

  const fmt = (iso: string) => format(new Date(iso), 'PPP', { locale: dfLocale });
  const isOpen = c.status === 'open';

  return (
    <Card padding="lg" className="flex flex-col gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-[var(--game-text)]">{c.title}</h3>
        <CaseStatusBadge status={c.status} />
      </div>

      <p className="text-xs text-[var(--game-text-muted)]">
        {t('weekly_case_window', { start: fmt(c.window_start), end: fmt(c.window_end) })}
      </p>

      <RichDescription html={c.content} className="text-[var(--game-text)]" />

      <div className="border-t border-[var(--game-border)] pt-4">
        <AnswerEditor
          key={c.id}
          caseId={c.id}
          isOpen={isOpen}
          myAnswer={data.my_answer ?? null}
        />
      </div>

      {data.resolution && (
        <div className="border-t border-[var(--game-border)] pt-4">
          <ResolutionPanel resolution={data.resolution} />
        </div>
      )}
    </Card>
  );
}
