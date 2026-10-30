'use client';

import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { m, useReducedMotion } from 'framer-motion';
import { CalendarClock, FileText, FolderOpen } from 'lucide-react';
import { RichDescription } from '@/components/common/RichDescription';
import { CaseStatusBadge } from './CaseStatusBadge';
import { AnswerEditor } from './AnswerEditor';
import { ResolutionPanel } from './ResolutionPanel';
import { useNow } from '../useNow';
import type { WeeklyCaseResult } from '@/lib/comunidad/weekly-case';

/** "Cierra en 3 días" / "Cierra en 5 h" / "Cierra pronto" / null when past. */
function useClosesIn(endIso: string, now: number): string | null {
  const t = useTranslations('comunidadEstrategica');
  const ms = new Date(endIso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return t('weekly_case_closes_days', { count: Math.floor(hours / 24) });
  if (hours >= 1) return t('weekly_case_closes_hours', { count: hours });
  return t('weekly_case_closes_soon');
}

/**
 * The current (or latest) weekly case as a case file: navy folder tab with
 * the status stamp, the window as a progress timeline with time left, the
 * statement on a ruled "paper" sheet, the player's answer and the resolution.
 */
export function CurrentCaseCard({ data }: { data: WeeklyCaseResult }) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const now = useNow(60_000);
  const dfLocale = locale === 'en' ? enUS : esLocale;

  const c = data.case;
  const closesIn = useClosesIn(c?.window_end ?? '', now);

  if (!c) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--game-radius)] border-2 border-dashed border-[var(--game-border)] bg-[var(--game-surface)] px-6 py-12 text-center">
        <span className="game-anim-float flex size-16 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-accent)]">
          <FolderOpen className="size-8" />
        </span>
        <p className="max-w-sm text-sm text-[var(--game-text-muted)]">{t('weekly_case_empty')}</p>
      </div>
    );
  }

  const fmt = (iso: string) => format(new Date(iso), 'PPP', { locale: dfLocale });
  const isOpen = c.status === 'open';
  const start = new Date(c.window_start).getTime();
  const end = new Date(c.window_end).getTime();
  const elapsed = Math.min(Math.max((now - start) / Math.max(end - start, 1), 0), 1);

  return (
    <m.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col"
    >
      {/* Folder tab */}
      <div className="flex">
        <span className="inline-flex items-center gap-2 rounded-t-xl bg-[var(--game-case-navy)] px-4 pb-2 pt-2.5 text-xs font-bold uppercase tracking-[0.18em] text-white/90">
          <FileText className="size-3.5" />
          {t('weekly_case_file_label')}
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--game-radius)] rounded-tl-none bg-[linear-gradient(160deg,var(--game-case-navy),var(--game-case-navy-deep))] p-1.5 shadow-[0_18px_38px_-20px_var(--game-case-navy)]">
        {/* Header on the folder */}
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-3 text-white">
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold leading-tight">{c.title}</h3>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/70">
              <CalendarClock className="size-3.5" />
              {t('weekly_case_window', { start: fmt(c.window_start), end: fmt(c.window_end) })}
            </p>
          </div>
          <span className="rounded-lg bg-white/95 px-2 py-1.5">
            <CaseStatusBadge status={c.status} variant="stamp" />
          </span>
        </div>

        {/* Window timeline */}
        {isOpen && (
          <div className="px-4 pb-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <m.div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--game-rank-gold-light),var(--game-rank-gold))]"
                initial={{ width: reduceMotion ? `${elapsed * 100}%` : 0 }}
                animate={{ width: `${Math.max(elapsed, 0.03) * 100}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut' }}
              />
            </div>
            {closesIn && (
              <p className="mt-1.5 text-right text-xs font-semibold text-[var(--game-rank-gold-light)]" suppressHydrationWarning>
                {closesIn}
              </p>
            )}
          </div>
        )}

        {/* Paper sheet */}
        <div
          className="relative flex flex-col gap-5 rounded-[calc(var(--game-radius)-4px)] bg-[var(--game-case-paper)] p-5 pl-8 sm:p-7 sm:pl-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, var(--game-case-paper-line) 31px, var(--game-case-paper-line) 32px)',
          }}
        >
          {/* Red margin line */}
          <span aria-hidden className="absolute inset-y-0 left-4 w-px bg-[var(--game-case-margin)] sm:left-6" />

          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--game-text-muted)]">
              {t('weekly_case_statement')}
            </h4>
            <RichDescription html={c.content} className="text-[var(--game-text)]" />
          </section>

          <div className="border-t border-dashed border-[var(--game-border)] pt-5">
            <AnswerEditor key={c.id} caseId={c.id} isOpen={isOpen} myAnswer={data.my_answer ?? null} />
          </div>

          {data.resolution && (
            <div className="border-t border-dashed border-[var(--game-border)] pt-5">
              <ResolutionPanel resolution={data.resolution} />
            </div>
          )}
        </div>
      </div>
    </m.article>
  );
}
