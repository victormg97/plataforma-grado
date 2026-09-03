'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { CalendarDays, Search, Sparkles, Info, Check } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { RichDescription } from '@/components/common/RichDescription';
import { useAdminDailyQuestions } from '@/lib/hooks/useComunidadAdmin';
import { DailyQuestionPicker } from '../DailyQuestionPicker';

/**
 * Daily question curation (Req. 13).
 *
 * The daily question is the single question every player answers on a given
 * day. By default the system picks one automatically; here an admin can
 * override which question runs on a specific date, and review the history of
 * what ran (and when).
 */
export function DailyQuestionTab() {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : esLocale;
  const today = new Date().toISOString().slice(0, 10);

  const { data: curated } = useAdminDailyQuestions();

  const [date, setDate] = useState(today);

  // What's already assigned to the currently selected date?
  const assignedForDate = useMemo(
    () => (curated ?? []).find((c) => c.question_date === date),
    [curated, date]
  );

  const formatDate = (iso: string) => {
    try {
      return format(parseISO(iso), 'PPP', { locale: dateLocale });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* What is this tab */}
      <Card padding="lg" className="flex gap-3 bg-[var(--color-brand-gold-muted)]">
        <Info className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-gold)]" />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('daily_intro_title')}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{t('daily_intro_desc')}</p>
        </div>
      </Card>

      {/* Step 1: choose the date */}
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-[var(--color-brand-gold)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('daily_step1_title')}
          </h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">{t('daily_step1_hint')}</p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
          />
          {date === today && (
            <span className="inline-flex items-center rounded-full bg-[var(--color-brand-gold-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
              {t('daily_today_badge')}
            </span>
          )}
        </div>

        {/* Current assignment for the chosen date */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('daily_assigned_label', { date: formatDate(date) })}
          </p>
          {assignedForDate ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {assignedForDate.subject_name && (
                  <span className="inline-flex items-center rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
                    {assignedForDate.subject_name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  {assignedForDate.is_manually_curated ? (
                    <>
                      <Check className="size-3" /> {t('daily_manual')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" /> {t('daily_auto')}
                    </>
                  )}
                </span>
              </div>
              {assignedForDate.question_content ? (
                <RichDescription
                  html={assignedForDate.question_content}
                  className="text-[var(--color-text-primary)]"
                />
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {t('daily_question_unavailable')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">{t('daily_none_assigned')}</p>
          )}
        </div>
      </Card>

      {/* Step 2: pick a question to assign */}
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-[var(--color-brand-gold)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('daily_step2_title')}
          </h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('daily_step2_hint', { date: formatDate(date) })}
        </p>

        <DailyQuestionPicker
          date={date}
          onDateChange={setDate}
          assignedQuestionId={assignedForDate?.question_id ?? null}
          today={today}
        />
      </Card>

      {/* History */}
      <Card padding="lg" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t('daily_recent_title')}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">{t('daily_recent_hint')}</p>
        {(curated ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('daily_recent_empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-border)]">
            {(curated ?? []).map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {formatDate(c.question_date)}
                  </span>
                  {c.subject_name && (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      {c.subject_name}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    {c.is_manually_curated ? (
                      <>
                        <Check className="size-3" /> {t('daily_manual')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3" /> {t('daily_auto')}
                      </>
                    )}
                  </span>
                </div>
                {c.question_content ? (
                  <RichDescription
                    html={c.question_content}
                    className="line-clamp-2 text-[var(--color-text-secondary)]"
                  />
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t('daily_question_unavailable')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
