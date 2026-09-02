import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { RichDescription } from '@/components/common/RichDescription';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { useWeeklyCaseHistory, useWeeklyCaseDetail } from '@/lib/hooks/useComunidad';
import { CaseStatusBadge } from './CaseStatusBadge';
import { AnswerEditor } from './AnswerEditor';
import { ResolutionPanel } from './ResolutionPanel';
import { GameErrorState } from '../GameErrorState';

/**
 * Navigable history of closed/resolved cases (newest first, Req. 10). The open
 * case id lives in the ?case= query param; opening one fetches its detail with
 * the same visibility control as the current case.
 */
export function CaseHistoryList() {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dfLocale = locale === 'en' ? enUS : esLocale;

  const { data, isLoading, isError, refetch } = useWeeklyCaseHistory();
  const [openId, setOpenId] = useQueryParam('case');
  const { data: detail, isLoading: detailLoading } = useWeeklyCaseDetail(openId);

  const fmt = (iso: string) => format(new Date(iso), 'PP', { locale: dfLocale });

  if (isLoading) {
    return (
      <div
        className="flex justify-center py-8"
        role="status"
        aria-live="polite"
        aria-label={t('loading')}
      >
        <div className="size-6 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return <GameErrorState onRetry={() => refetch()} />;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-[var(--game-text-muted)]">{t('weekly_case_history_empty')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-bold text-[var(--game-text)]">{t('weekly_case_history_title')}</h3>

      {items.map((item) => {
        const expanded = openId === item.id;
        return (
          <Card
            key={item.id}
            padding="md"
            className="border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
          >
            <button
              type="button"
              onClick={() => setOpenId(expanded ? null : item.id)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={expanded}
            >
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[var(--game-text)]">{item.title}</span>
                <span className="text-xs text-[var(--game-text-muted)]">
                  {fmt(item.window_start)} – {fmt(item.window_end)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CaseStatusBadge status={item.status} />
                {expanded ? (
                  <ChevronUp className="size-4 text-[var(--game-text-muted)]" />
                ) : (
                  <ChevronDown className="size-4 text-[var(--game-text-muted)]" />
                )}
              </div>
            </button>

            {expanded && (
              <div className="mt-4 flex flex-col gap-4 border-t border-[var(--game-border)] pt-4">
                {detailLoading || !detail?.case ? (
                  <div className="flex justify-center py-4">
                    <div className="size-5 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <RichDescription html={detail.case.content} className="text-[var(--game-text)]" />

                    <div className="border-t border-[var(--game-border)] pt-4">
                      <AnswerEditor
                        key={detail.case.id}
                        caseId={detail.case.id}
                        isOpen={detail.case.status === 'open'}
                        myAnswer={detail.my_answer ?? null}
                      />
                    </div>

                    {detail.resolution && (
                      <div className="border-t border-[var(--game-border)] pt-4">
                        <ResolutionPanel resolution={detail.resolution} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
