import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Archive, CheckCircle2, ChevronDown, Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RichDescription } from '@/components/common/RichDescription';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { useWeeklyCaseHistory, useWeeklyCaseDetail } from '@/lib/hooks/useComunidad';
import { CaseStatusBadge } from './CaseStatusBadge';
import { AnswerEditor } from './AnswerEditor';
import { ResolutionPanel } from './ResolutionPanel';
import { GameErrorState } from '../GameErrorState';

/**
 * Archive of past cases as a timeline (newest first, Req. 10): each entry
 * shows its window, status and whether the player answered / the ruling is
 * available. The open case id lives in ?case=; opening one fetches its detail
 * with the same visibility control as the current case.
 */
export function CaseHistoryList() {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const dfLocale = locale === 'en' ? enUS : esLocale;

  const { data, isLoading, isError, refetch } = useWeeklyCaseHistory();
  const [openId, setOpenId] = useQueryParam('case');
  const { data: detail, isLoading: detailLoading } = useWeeklyCaseDetail(openId);

  const fmt = (iso: string) => format(new Date(iso), 'PP', { locale: dfLocale });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8" role="status" aria-live="polite" aria-label={t('loading')}>
        <div className="size-6 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
      </div>
    );
  }

  if (isError) return <GameErrorState onRetry={() => refetch()} />;

  const items = data?.items ?? [];

  return (
    <section className="flex flex-col gap-4">
      <h3 className="inline-flex items-center gap-2 text-base font-bold text-[var(--game-text)]">
        <Archive className="size-5 text-[var(--game-case-navy)]" />
        {t('weekly_case_history_title')}
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--game-text-muted)]">{t('weekly_case_history_empty')}</p>
      ) : (
        <ol className="relative flex flex-col gap-3 pl-6">
          {/* Timeline spine */}
          <span aria-hidden className="absolute bottom-3 left-[9px] top-3 w-0.5 rounded-full bg-[var(--game-border)]" />

          {items.map((item, i) => {
            const expanded = openId === item.id;
            return (
              <m.li
                key={item.id}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduceMotion ? 0 : Math.min(i, 8) * 0.05 }}
                className="relative"
              >
                {/* Timeline dot */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute -left-6 top-5 size-[18px] rounded-full border-4 border-[var(--game-bg)]',
                    item.status === 'resolved' ? 'bg-[var(--game-stamp-resolved)]' : 'bg-[var(--game-stamp-closed)]'
                  )}
                />

                <div
                  className={cn(
                    'overflow-hidden rounded-[var(--game-radius)] border bg-[var(--game-surface)] shadow-[var(--game-shadow)] transition-colors',
                    expanded ? 'border-[var(--game-case-navy)]' : 'border-transparent'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : item.id)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-[var(--game-text)]">{item.title}</span>
                      <span className="text-xs text-[var(--game-text-muted)]">
                        {fmt(item.window_start)} – {fmt(item.window_end)}
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <CaseStatusBadge status={item.status} />
                        {item.i_answered && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--game-correct)]/12 px-2.5 py-1 text-[11px] font-bold text-[var(--game-correct)]">
                            <CheckCircle2 className="size-3" />
                            {t('weekly_case_you_answered')}
                          </span>
                        )}
                        {item.resolution_visible && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--game-rank-gold-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--game-rank-gold-dark)]">
                            <Gavel className="size-3" />
                            {t('weekly_case_ruling_available')}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn('size-5 shrink-0 text-[var(--game-text-muted)] transition-transform', expanded && 'rotate-180')}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <m.div
                        key="detail"
                        initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-5 border-t border-dashed border-[var(--game-border)] bg-[var(--game-case-paper)] p-5">
                          {detailLoading || !detail?.case ? (
                            <div className="flex justify-center py-4">
                              <div className="size-5 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
                            </div>
                          ) : (
                            <>
                              <RichDescription html={detail.case.content} className="text-[var(--game-text)]" />
                              <div className="border-t border-dashed border-[var(--game-border)] pt-5">
                                <AnswerEditor
                                  key={detail.case.id}
                                  caseId={detail.case.id}
                                  isOpen={detail.case.status === 'open'}
                                  myAnswer={detail.my_answer ?? null}
                                />
                              </div>
                              {detail.resolution && (
                                <div className="border-t border-dashed border-[var(--game-border)] pt-6">
                                  <ResolutionPanel resolution={detail.resolution} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </m.li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
