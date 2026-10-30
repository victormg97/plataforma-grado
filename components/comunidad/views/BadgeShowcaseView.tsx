'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { m, useReducedMotion } from 'framer-motion';
import { Award, CalendarCheck, ChevronRight, Lock, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/common/Modal';
import { useUserBadges } from '@/lib/hooks/useComunidad';
import { BadgeCard, BadgeMedallion, criteriaLabel, isNewBadge } from '../badges/BadgeCard';
import { GameErrorState } from '../GameErrorState';
import type { LockedBadge, UnlockedBadge } from '@/lib/comunidad/badge';

type AnyBadge = (UnlockedBadge | LockedBadge) & { locked: boolean };

/** "racha-diaria" → "Racha diaria". */
function seriesTitle(key: string): string {
  const s = key.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Badge trophy case: collection progress, series shown as tier tracks
 * (bronze → gold style progression with the next one to unlock highlighted)
 * and the standalone badges as a medallion grid. Any badge opens a detail
 * modal with how to unlock it or when it was earned.
 */
export function BadgeShowcaseView() {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isError, refetch } = useUserBadges();
  const [selected, setSelected] = useState<AnyBadge | null>(null);
  // Fixed per mount: "new" tags don't flicker on re-render.
  const [now] = useState(() => Date.now());

  const { series, standalone, unlockedCount, total } = useMemo(() => {
    const all: AnyBadge[] = [
      ...(data?.unlocked ?? []).map((b) => ({ ...b, locked: false })),
      ...(data?.locked ?? []).map((b) => ({ ...b, locked: true })),
    ];
    const bySeries = new Map<string, AnyBadge[]>();
    const loose: AnyBadge[] = [];
    for (const b of all) {
      if (b.series_key) {
        const list = bySeries.get(b.series_key) ?? [];
        list.push(b);
        bySeries.set(b.series_key, list);
      } else loose.push(b);
    }
    const seriesList = [...bySeries.entries()]
      .map(([key, list]) => ({
        key,
        badges: list.sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
    // Unlocked first, then locked.
    loose.sort((a, b) => Number(a.locked) - Number(b.locked));
    return {
      series: seriesList,
      standalone: loose,
      unlockedCount: data?.unlocked.length ?? 0,
      total: all.length,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" role="status" aria-live="polite" aria-label={t('loading')}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]" />
        ))}
      </div>
    );
  }

  if (isError) return <GameErrorState onRetry={() => refetch()} />;

  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Collection header ── */}
      <header className="relative isolate overflow-hidden rounded-[var(--game-radius)] bg-[linear-gradient(135deg,var(--game-rank-gold-light),var(--game-rank-gold)_55%,var(--game-rank-gold-dark))] p-5 text-[var(--game-rank-gold-dark)] shadow-[0_16px_34px_-18px_var(--game-rank-gold)] sm:p-6">
        <span aria-hidden className="game-anim-float absolute -right-8 -top-10 -z-10 size-40 rounded-full bg-white/25" />
        <span aria-hidden className="absolute -bottom-10 left-1/4 -z-10 size-28 rounded-full bg-white/15" />
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/45 ring-1 ring-white/60">
            <Medal className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold">{t('badges_title')}</h2>
            <p className="text-sm font-medium opacity-80">{t('badges_collection', { unlocked: unlockedCount, total })}</p>
          </div>
          <span className="text-3xl font-black tabular-nums">{pct}%</span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/40">
          <m.div
            className="h-full rounded-full bg-[var(--game-rank-gold-dark)]"
            initial={{ width: reduceMotion ? `${pct}%` : 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.9, ease: 'easeOut', delay: 0.15 }}
          />
        </div>
      </header>

      {total === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[var(--game-radius)] border-2 border-dashed border-[var(--game-border)] bg-[var(--game-surface)] px-6 py-12 text-center">
          <Award className="size-10 text-[var(--game-text-muted)]" />
          <p className="text-sm text-[var(--game-text-muted)]">{t('badges_unlocked_empty')}</p>
        </div>
      )}

      {/* ── Series: tier tracks ── */}
      {series.map((s) => {
        const got = s.badges.filter((b) => !b.locked).length;
        const nextId = s.badges.find((b) => b.locked)?.id;
        return (
          <section key={s.key} className="flex flex-col gap-3 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[var(--game-text)]">{seriesTitle(s.key)}</h3>
              <span className="rounded-full bg-[var(--game-rank-gold-bg)] px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--game-rank-gold-dark)]">
                {got}/{s.badges.length}
              </span>
            </div>
            <ol className="flex items-start gap-1 overflow-x-auto pb-1">
              {s.badges.map((b, i) => (
                <li key={b.id} className="flex shrink-0 items-start">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'mt-8 h-1 w-6 rounded-full sm:w-10',
                        !b.locked ? 'bg-[var(--game-rank-gold)]' : 'bg-[var(--game-border)]'
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelected(b)}
                    className="group flex w-24 flex-col items-center gap-1.5 rounded-xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-rank-gold)]"
                  >
                    <span
                      className={cn(
                        'relative rounded-full transition-transform duration-300 group-hover:scale-105',
                        b.id === nextId && 'ring-4 ring-[var(--game-accent)]/25 ring-offset-2 ring-offset-[var(--game-surface)]'
                      )}
                    >
                      <BadgeMedallion badge={b} locked={b.locked} size="sm" />
                    </span>
                    <span className={cn('line-clamp-2 text-[11px] font-semibold', b.locked ? 'text-[var(--game-text-muted)]' : 'text-[var(--game-text)]')}>
                      {b.name}
                    </span>
                    {b.id === nextId && (
                      <span className="rounded-full bg-[var(--game-accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--game-on-accent)]">
                        {t('badge_next')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {/* ── Standalone badges ── */}
      {standalone.length > 0 && (
        <section className="flex flex-col gap-3">
          {series.length > 0 && (
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--game-text-muted)]">{t('badges_other')}</h3>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {standalone.map((b, i) => (
              <BadgeCard
                key={b.id}
                badge={b}
                locked={b.locked}
                isNew={!b.locked && isNewBadge(b, now)}
                index={i}
                onOpen={() => setSelected(b)}
              />
            ))}
          </div>
        </section>
      )}

      {selected && <BadgeDetailModal badge={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/** Big medallion reveal + how to unlock / when it was earned. */
function BadgeDetailModal({ badge, onClose }: { badge: AnyBadge; onClose: () => void }) {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const criteria = badge.locked ? criteriaLabel((badge as LockedBadge).criteria, t) : null;
  const grantedAt = !badge.locked ? (badge as UnlockedBadge).granted_at : null;

  return (
    <Modal open onClose={onClose} title={badge.name}>
      {/* game-scope: the medallion uses the game palette inside the portal */}
      <div className="game-scope flex flex-col items-center gap-4 text-center">
        <m.span
          initial={reduceMotion ? false : { scale: 0.4, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="group"
        >
          <BadgeMedallion badge={badge} locked={badge.locked} size="lg" />
        </m.span>

        {badge.description && <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{badge.description}</p>}

        {badge.locked ? (
          <div className="flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-left">
            <Lock className="mt-0.5 size-4 shrink-0 text-[var(--color-text-muted)]" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('badge_how_to')}</div>
              <p className="text-sm text-[var(--color-text-primary)]">{criteria ?? t('badge_criteria_hidden')}</p>
            </div>
          </div>
        ) : (
          grantedAt && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-gold-muted)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand-gold)]">
              <CalendarCheck className="size-4" />
              {t('badge_earned_on', {
                date: format(new Date(grantedAt), 'PPP', { locale: locale === 'en' ? enUS : esLocale }),
              })}
            </div>
          )
        )}

        {badge.series_key && (
          <p className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <ChevronRight className="size-3.5" />
            {t('badge_in_series', { series: seriesTitle(badge.series_key) })}
          </p>
        )}
      </div>
    </Modal>
  );
}
