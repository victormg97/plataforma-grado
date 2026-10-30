import { useTranslations } from 'next-intl';
import { Scale } from 'lucide-react';
import { useWeeklyCase } from '@/lib/hooks/useComunidad';
import { CurrentCaseCard } from '@/components/comunidad/weekly-case/CurrentCaseCard';
import { CaseHistoryList } from '@/components/comunidad/weekly-case/CaseHistoryList';
import { GameErrorState } from '@/components/comunidad/GameErrorState';

/**
 * Weekly case, styled as a law firm's case file: a navy hero, the current
 * case as an open folder (stamp, window timeline, ruled paper, answer and
 * ruling) and the archive of past cases as a timeline.
 */
export function WeeklyCaseView() {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useWeeklyCase();

  return (
    <div className="flex flex-col gap-6">
      <header className="relative isolate flex items-center gap-4 overflow-hidden rounded-[var(--game-radius)] bg-[linear-gradient(135deg,var(--game-case-navy),var(--game-case-navy-deep))] p-5 text-white shadow-[var(--game-shadow)]">
        <span aria-hidden className="game-anim-float absolute -right-10 -top-12 -z-10 size-40 rounded-full bg-[var(--game-rank-gold)]/20" />
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
          <Scale className="size-7 text-[var(--game-rank-gold-light)]" />
        </span>
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--game-rank-gold-light)]">
            {t('weekly_case_kicker')}
          </span>
          <h2 className="text-xl font-extrabold">{t('nav_weekly_case')}</h2>
          <p className="text-sm text-white/75">{t('weekly_case_subtitle')}</p>
        </div>
      </header>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]" role="status" aria-label={t('loading')} />
      ) : isError ? (
        <GameErrorState onRetry={() => refetch()} />
      ) : (
        data && <CurrentCaseCard data={data} />
      )}

      <CaseHistoryList />
    </div>
  );
}
