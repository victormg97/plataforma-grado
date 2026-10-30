'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { format, parse } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Game-styled month picker for the ranking. Only lists months that have data
 * (`months`, 'YYYY-MM', newest first, from get_ranking_page).
 *  - Compact pill: ‹ previous · month label · next ›.
 *  - The label opens a small panel with the months grouped by year as a
 *    4-column chip grid (scrolls if the history grows), so it stays compact
 *    with many months.
 * value null = current month (the RPC's default).
 */
export function MonthPicker({
  months,
  value,
  currentMonth,
  onChange,
}: {
  months: string[];
  value: string | null;
  /** 'YYYY-MM' of the current month (maps to null). */
  currentMonth: string;
  onChange: (month: string | null) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dfLocale = locale === 'en' ? enUS : esLocale;
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = value ?? currentMonth;
  const list = months.length > 0 ? months : [currentMonth];
  const index = Math.max(list.indexOf(selected), 0);
  const older = list[index + 1];
  const newer = index > 0 ? list[index - 1] : undefined;

  const toDate = (ym: string) => parse(ym, 'yyyy-MM', new Date());
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const longLabel = (ym: string) => capital(format(toDate(ym), 'LLLL yyyy', { locale: dfLocale }));
  const shortMonth = (ym: string) => capital(format(toDate(ym), 'LLL', { locale: dfLocale }).replace('.', ''));

  const select = (ym: string) => {
    onChange(ym === currentMonth ? null : ym);
    setOpen(false);
  };

  // Months grouped by year, newest year first.
  const groups = new Map<string, string[]>();
  for (const ym of list) {
    const year = ym.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), ym]);
  }
  const byYear = [...groups.entries()].map(([year, items]) => ({ year, items: [...items].sort() }));

  // Outside tap + Escape close the panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const arrowClass =
    'flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--game-text-muted)] transition-colors hover:bg-[var(--game-surface)] hover:text-[var(--game-accent)] disabled:pointer-events-none disabled:opacity-30';

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-0.5 rounded-full border border-[var(--game-border)] bg-[var(--game-surface-muted)]/80 p-1 backdrop-blur-sm">
        <button
          type="button"
          className={arrowClass}
          onClick={() => older && select(older)}
          disabled={!older}
          aria-label={t('ranking_month_prev')}
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={t('ranking_month_label')}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-[var(--game-text)] transition-colors hover:bg-[var(--game-surface)]"
        >
          <CalendarDays className="size-4 shrink-0 text-[var(--game-rank-gold-dark)]" />
          <span className="truncate">{selected === currentMonth ? t('ranking_month_current') : longLabel(selected)}</span>
          <ChevronDown
            className={cn('size-3.5 shrink-0 text-[var(--game-text-muted)] transition-transform', open && 'rotate-180')}
          />
        </button>

        <button
          type="button"
          className={arrowClass}
          onClick={() => newer && select(newer)}
          disabled={!newer}
          aria-label={t('ranking_month_next')}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <m.div
            id={panelId}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.6 }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-[var(--game-radius)] border border-[var(--game-border)] bg-[var(--game-surface)] p-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.35)]"
          >
            <div className="flex max-h-64 flex-col gap-3 overflow-y-auto overscroll-contain pr-0.5">
              {byYear.map(({ year, items }) => (
                <div key={year}>
                  <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--game-text-muted)]">
                    {year}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {items.map((ym) => {
                      const active = ym === selected;
                      const isCurrent = ym === currentMonth;
                      return (
                        <button
                          key={ym}
                          type="button"
                          onClick={() => select(ym)}
                          aria-pressed={active}
                          title={longLabel(ym)}
                          className={cn(
                            'relative rounded-[var(--game-radius-sm)] px-1 py-2 text-xs font-bold transition-colors',
                            active
                              ? 'bg-[linear-gradient(135deg,var(--game-accent),var(--game-header-bg))] text-white shadow-[0_8px_16px_-10px_var(--game-accent)]'
                              : 'bg-[var(--game-surface-muted)] text-[var(--game-text)] hover:bg-[var(--game-accent-muted)] hover:text-[var(--game-accent)]'
                          )}
                        >
                          {shortMonth(ym)}
                          {isCurrent && (
                            <span
                              aria-hidden
                              className={cn(
                                'absolute right-1 top-1 size-1.5 rounded-full',
                                active ? 'bg-[var(--game-rank-gold-light)]' : 'bg-[var(--game-rank-gold)]'
                              )}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
