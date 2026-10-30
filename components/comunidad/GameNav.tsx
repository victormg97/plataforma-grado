'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Award, BookOpen, CalendarCheck, ChevronLeft, ChevronRight, Flame, Home, Scale, Swords, Trophy } from 'lucide-react';
import { useDailyQuestion, useGameProfile, useWeeklyCase } from '@/lib/hooks/useComunidad';
import type { GameView } from './views';
import type { GameSettingsResponse } from '@/lib/hooks/useComunidad';

interface NavEntry {
  view: GameView;
  labelKey: string;
  Icon: typeof Home;
  /** Section tone (main + deep), matching each screen's own look. */
  tone: [string, string];
}

const ENTRIES: NavEntry[] = [
  { view: 'home', labelKey: 'nav_home', Icon: Home, tone: ['var(--game-accent)', 'var(--game-header-bg)'] },
  { view: 'daily', labelKey: 'nav_daily', Icon: CalendarCheck, tone: ['var(--game-gold)', 'var(--game-accent)'] },
  { view: 'quiz', labelKey: 'nav_quiz', Icon: BookOpen, tone: ['var(--game-accent)', 'var(--game-header-bg)'] },
  { view: 'streak', labelKey: 'nav_streak', Icon: Flame, tone: ['var(--game-fire-hot)', 'var(--game-fire-deep)'] },
  { view: 'ranking', labelKey: 'nav_ranking', Icon: Trophy, tone: ['var(--game-rank-gold)', 'var(--game-rank-gold-dark)'] },
  { view: 'challenges', labelKey: 'nav_challenges', Icon: Swords, tone: ['var(--quiz-tone-sky)', 'var(--quiz-tone-indigo)'] },
  { view: 'badges', labelKey: 'nav_badges', Icon: Award, tone: ['var(--game-rank-gold)', 'var(--game-rank-gold-dark)'] },
  { view: 'weekly-case', labelKey: 'nav_weekly_case', Icon: Scale, tone: ['var(--game-case-navy)', 'var(--game-case-navy-deep)'] },
];

/** Views whose screen belongs to a nav entry (sub-screens light up their parent). */
const PARENT: Partial<Record<GameView, GameView>> = { 'daily-result': 'daily' };

/**
 * Section bar of the mini-app.
 *  - Sticky at the top of the scroll area, on a frosted pill.
 *  - Each section keeps its own color: the active one gets a gradient pill
 *    in that tone (animated between sections) and a lifted icon.
 *  - Desktop: one row with icon + label. Tablet: same, scrollable with fade
 *    edges and arrows. Mobile: compact icon-over-label tiles, scrollable,
 *    the active one auto-scrolled into view.
 *  - "Pending" dots: today's question not answered, streak at risk, an open
 *    weekly case without an answer. Read from the cache (no requests).
 */
export function GameNav({
  active,
  onNavigate,
  settings,
}: {
  active: GameView;
  onNavigate: (view: GameView) => void;
  settings?: GameSettingsResponse;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Partial<Record<GameView, HTMLButtonElement | null>>>({});
  const [edges, setEdges] = useState({ left: false, right: false });

  const current = PARENT[active] ?? active;

  // Pending dots from cached data.
  const { data: daily } = useDailyQuestion();
  const { data: profile } = useGameProfile();
  const { data: weekly } = useWeeklyCase();
  const pending: Partial<Record<GameView, 'dot' | 'urgent'>> = {};
  if (daily?.question && !daily.already_answered) pending.daily = 'dot';
  if (profile?.streak_status === 'at_risk') pending.streak = 'urgent';
  if (weekly?.case?.status === 'open' && !weekly.my_answer) pending['weekly-case'] = 'dot';

  const labelFor = (entry: NavEntry): string => {
    switch (entry.view) {
      case 'daily':
        return settings?.section_name_daily_question || t('nav_daily');
      case 'streak':
        return settings?.section_name_streak || t('nav_streak');
      case 'ranking':
        return settings?.section_name_ranking || t('nav_ranking');
      case 'challenges':
        return settings?.section_name_challenges || t('nav_challenges');
      case 'badges':
        return settings?.section_name_badges || t('nav_badges');
      case 'weekly-case':
        return settings?.section_name_weekly_case || t('nav_weekly_case');
      default:
        return t(entry.labelKey);
    }
  };

  // Fade edges / arrows only when the row actually overflows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  // Keep the active section visible on small screens.
  useEffect(() => {
    const el = scrollRef.current;
    const item = itemRefs.current[current];
    if (!el || !item || el.scrollWidth <= el.clientWidth) return;
    const target = item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(target, 0), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [current, reduceMotion]);

  const scrollBy = (dir: -1 | 1) =>
    scrollRef.current?.scrollBy({ left: dir * scrollRef.current.clientWidth * 0.7, behavior: 'smooth' });

  return (
    <nav
      aria-label={t('nav_label')}
      className="sticky top-2 z-30 rounded-[calc(var(--game-radius)+4px)] border border-[var(--game-border)] bg-[var(--game-surface)]/85 p-1.5 shadow-[var(--game-shadow)] backdrop-blur-md"
    >
      <div className="relative">
        {/* Scroll arrows (only when overflowing, sm+) */}
        {edges.left && <ScrollArrow side="left" label={t('nav_scroll_left')} onClick={() => scrollBy(-1)} />}
        {edges.right && <ScrollArrow side="right" label={t('nav_scroll_right')} onClick={() => scrollBy(1)} />}

        {/*
          Edge fades are a mask on the scroller itself (not an overlay), so a
          partially hidden active pill fades out cleanly instead of showing its
          colored edge through a white veil. overscroll-x-none stops the touch
          rubber-band that dragged the pill past the rounded corners.
        */}
        <div
          ref={scrollRef}
          style={edgeMask(edges)}
          className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-none rounded-[var(--game-radius)] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] lg:snap-none lg:gap-1.5 [&::-webkit-scrollbar]:hidden"
        >
          {ENTRIES.map((entry) => {
            const isActive = current === entry.view;
            const dot = pending[entry.view];
            const { Icon } = entry;
            const style = {
              ['--nav-tone' as string]: entry.tone[0],
              ['--nav-tone-deep' as string]: entry.tone[1],
            } as CSSProperties;

            return (
              <button
                key={entry.view}
                ref={(el) => {
                  itemRefs.current[entry.view] = el;
                }}
                type="button"
                onClick={() => onNavigate(entry.view)}
                aria-current={isActive ? 'page' : undefined}
                style={style}
                className={cn(
                  'group relative flex shrink-0 snap-start items-center rounded-[var(--game-radius)] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--nav-tone)]',
                  // Mobile: icon over label. sm+: icon beside label.
                  'min-w-[4.5rem] flex-col justify-center gap-1 px-2.5 py-2 text-[11px]',
                  'sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-sm',
                  // lg: grow to fill the row but never shrink below the label
                  // (flex-1 let items shrink and truncated the labels).
                  'lg:grow lg:basis-auto lg:justify-center lg:px-2.5',
                  isActive ? 'text-white' : 'text-[var(--game-text-muted)] hover:text-[var(--game-text)]'
                )}
              >
                {/* Active pill in the section's tone (shared layout = slides between items) */}
                {isActive ? (
                  <m.span
                    layoutId="game-nav-active"
                    aria-hidden
                    className="absolute inset-0 rounded-[var(--game-radius)] bg-[linear-gradient(135deg,var(--nav-tone),var(--nav-tone-deep))] shadow-[0_8px_18px_-10px_var(--nav-tone)]"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 38 }}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-[var(--game-radius)] bg-[var(--game-surface-muted)] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                )}

                <span className="relative z-10 inline-flex">
                  <m.span
                    className={cn(
                      'inline-flex rounded-lg p-1 transition-colors',
                      isActive ? 'bg-white/20' : 'text-[var(--nav-tone)] group-hover:bg-[var(--game-surface)]'
                    )}
                    animate={isActive && !reduceMotion ? { y: [0, -3, 0], rotate: [0, -8, 0] } : { y: 0, rotate: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  >
                    <Icon className="size-[18px]" />
                  </m.span>
                  {dot && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2',
                        isActive ? 'ring-transparent' : 'ring-[var(--game-surface)]',
                        dot === 'urgent'
                          ? 'bg-[var(--game-fire-amber)] motion-safe:animate-pulse'
                          : 'bg-[var(--game-incorrect)]'
                      )}
                    />
                  )}
                </span>
                <span className="relative z-10 max-w-[6.5rem] truncate sm:max-w-none sm:overflow-visible sm:whitespace-nowrap">
                  {labelFor(entry)}
                </span>
                {dot && <span className="sr-only">{t(dot === 'urgent' ? 'nav_urgent' : 'nav_pending')}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/** Fade mask for the edges that have hidden content. */
function edgeMask(edges: { left: boolean; right: boolean }): CSSProperties | undefined {
  if (!edges.left && !edges.right) return undefined;
  const fade = '2.5rem';
  const left = edges.left ? `transparent 0, #000 ${fade}` : '#000 0';
  const right = edges.right ? `#000 calc(100% - ${fade}), transparent 100%` : '#000 100%';
  const mask = `linear-gradient(90deg, ${left}, ${right})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

function ScrollArrow({ side, label, onClick }: { side: 'left' | 'right'; label: string; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      tabIndex={-1}
      className={cn(
        'absolute top-1/2 z-30 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--game-border)] bg-[var(--game-surface)] text-[var(--game-text)] shadow-sm transition-colors hover:text-[var(--game-accent)] sm:flex',
        side === 'left' ? 'left-0.5' : 'right-0.5'
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
