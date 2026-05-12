'use client';

import { Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { TrackingTab } from '@/components/pagos/TrackingTab';
import { AnualTab } from '@/components/pagos/AnualTab';

const StatsTab = dynamic(
  () => import('@/components/pagos/StatsTab').then(m => m.StatsTab),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><div className="size-6 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" /></div> }
);

type Tab = 'seguimiento' | 'estadisticas' | 'anual';

const SPINNER = (
  <div className="flex items-center justify-center py-16">
    <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
  </div>
);

function PagosContent() {
  const t = useTranslations('pagos');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : es;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // URL state
  const [tabParam, setTab] = useQueryParam('tab');
  const [añoParam, setAño] = useQueryParam('año');
  const [mesParam] = useQueryParam('mes');

  const tab: Tab = (tabParam as Tab) || 'anual';
  const año = añoParam ? parseInt(añoParam, 10) : currentYear;
  const mes = mesParam ? parseInt(mesParam, 10) : currentMonth;

  const isCurrentMonth = año === currentYear && mes === currentMonth;

  // Formatted month label
  const mesLabel = useMemo(() => {
    const d = new Date(año, mes - 1, 1);
    return format(d, locale === 'en' ? 'MMMM yyyy' : 'MMMM yyyy', { locale: dateLocale });
  }, [año, mes, dateLocale, locale]);

  const setAñoMes = (newAño: number, newMes: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('año', String(newAño));
    params.set('mes', String(newMes));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handlePrevMonth = () => {
    let newMes = mes - 1;
    let newAño = año;
    if (newMes < 1) { newMes = 12; newAño--; }
    setAñoMes(newAño, newMes);
  };

  const handleNextMonth = () => {
    let newMes = mes + 1;
    let newAño = año;
    if (newMes > 12) { newMes = 1; newAño++; }
    setAñoMes(newAño, newMes);
  };

  const handleResetMonth = () => {
    setAñoMes(currentYear, currentMonth);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'anual', label: t('tab_anual') },
    { key: 'estadisticas', label: t('tab_estadisticas') },
    { key: 'seguimiento', label: t('tab_seguimiento') },
  ];

  return (
    <div className="space-y-[var(--space-md)]">
      <PageHeader title={t('titulo')} subtitle={t('subtitulo')} />

      {/* Month navigator (only for month-based tabs) */}
      {(tab === 'seguimiento' || tab === 'estadisticas') && (
        <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
          {/* Left half — prev month clickable zone */}
          <button
            onClick={handlePrevMonth}
            aria-label={t('mes_anterior')}
            className="absolute inset-y-0 left-0 w-1/2 cursor-pointer transition-colors hover:bg-[var(--color-brand-gold-muted)]/40 active:bg-[var(--color-brand-gold-muted)]/70"
          />
          {/* Right half — next month clickable zone */}
          <button
            onClick={handleNextMonth}
            aria-label={t('mes_siguiente')}
            className="absolute inset-y-0 right-0 w-1/2 cursor-pointer transition-colors hover:bg-[var(--color-brand-gold-muted)]/40 active:bg-[var(--color-brand-gold-muted)]/70"
          />

          {/* Arrow indicators — purely decorative, pointer-events-none */}
          <ChevronLeft className="pointer-events-none size-5 text-[var(--color-text-muted)]" />

          <div className="pointer-events-none relative flex flex-col items-center gap-0.5">
            <span
              className="text-base font-semibold capitalize text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {mesLabel}
            </span>
            {!isCurrentMonth ? (
              <button
                onClick={handleResetMonth}
                className="pointer-events-auto text-[10px] font-medium text-[var(--color-brand-gold)] hover:underline"
              >
                {t('mes_actual')}
              </button>
            ) : (
              <span className="text-[10px] font-medium text-[var(--color-brand-gold)]">
                {t('mes_actual')}
              </span>
            )}
          </div>

          <ChevronRight className="pointer-events-none size-5 text-[var(--color-text-muted)]" />
        </div>
      )}

      {/* Year navigator (only on annual tab) */}
      {tab === 'anual' && (
        <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
          {/* Left half — prev year */}
          <button
            onClick={() => setAño(String(año - 1))}
            aria-label="Año anterior"
            className="absolute inset-y-0 left-0 w-1/2 cursor-pointer transition-colors hover:bg-[var(--color-brand-gold-muted)]/40 active:bg-[var(--color-brand-gold-muted)]/70"
          />
          {/* Right half — next year */}
          <button
            onClick={() => setAño(String(año + 1))}
            aria-label="Año siguiente"
            className="absolute inset-y-0 right-0 w-1/2 cursor-pointer transition-colors hover:bg-[var(--color-brand-gold-muted)]/40 active:bg-[var(--color-brand-gold-muted)]/70"
          />

          <ChevronLeft className="pointer-events-none size-5 text-[var(--color-text-muted)]" />
          <div className="pointer-events-none flex flex-col items-center gap-0.5">
            <span
              className="text-base font-semibold text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {año}
            </span>
            <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
              {t('tab_anual')}
            </span>
          </div>
          <ChevronRight className="pointer-events-none size-5 text-[var(--color-text-muted)]" />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-[var(--color-border)]">
        {TABS.map((t_) => (
          <button
            key={t_.key}
            onClick={() => setTab(t_.key)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:px-5',
              tab === t_.key
                ? 'border-b-2 border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {t_.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-[var(--space-xl)]">
        {tab === 'seguimiento' && <TrackingTab año={año} mes={mes} />}
        {tab === 'estadisticas' && <StatsTab año={año} mes={mes} />}
        {tab === 'anual' && <AnualTab año={año} />}
      </div>
    </div>
  );
}

export default function AdminPagosPage() {
  return (
    <Suspense fallback={SPINNER}>
      <PagosContent />
    </Suspense>
  );
}
