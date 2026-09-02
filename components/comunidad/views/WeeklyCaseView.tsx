import { useTranslations } from 'next-intl';
import { useWeeklyCase } from '@/lib/hooks/useComunidad';
import { CurrentCaseCard } from '@/components/comunidad/weekly-case/CurrentCaseCard';
import { CaseHistoryList } from '@/components/comunidad/weekly-case/CaseHistoryList';
import { GameErrorState } from '@/components/comunidad/GameErrorState';

/**
 * Player view for the weekly case (Slice 4). Replaces the former stub.
 * Shows the current (or latest) case with the answer editor and resolution,
 * plus the navigable history. Lives inside GameThemeScope (--game-* tokens).
 */
export function WeeklyCaseView() {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useWeeklyCase();

  if (isLoading) {
    return (
      <div
        className="flex justify-center py-16"
        role="status"
        aria-live="polite"
        aria-label={t('loading')}
      >
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return <GameErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {data && <CurrentCaseCard data={data} />}
      <CaseHistoryList />
    </div>
  );
}
