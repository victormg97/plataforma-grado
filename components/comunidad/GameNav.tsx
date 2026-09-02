'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Home, CalendarCheck, Flame, Trophy, Swords, Award, Scale, BookOpen } from 'lucide-react';
import type { GameView } from './views';
import type { GameSettingsResponse } from '@/lib/hooks/useComunidad';

interface NavEntry {
  view: GameView;
  labelKey: string;
  icon: React.ReactNode;
}

const ENTRIES: NavEntry[] = [
  { view: 'home', labelKey: 'nav_home', icon: <Home className="size-4" /> },
  { view: 'daily', labelKey: 'nav_daily', icon: <CalendarCheck className="size-4" /> },
  { view: 'quiz', labelKey: 'nav_quiz', icon: <BookOpen className="size-4" /> },
  { view: 'streak', labelKey: 'nav_streak', icon: <Flame className="size-4" /> },
  { view: 'ranking', labelKey: 'nav_ranking', icon: <Trophy className="size-4" /> },
  { view: 'challenges', labelKey: 'nav_challenges', icon: <Swords className="size-4" /> },
  { view: 'badges', labelKey: 'nav_badges', icon: <Award className="size-4" /> },
  { view: 'weekly-case', labelKey: 'nav_weekly_case', icon: <Scale className="size-4" /> },
];

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

  // Prefer admin-configured section names when available.
  const labelFor = (entry: NavEntry): string => {
    switch (entry.view) {
      case 'daily':
        return settings?.section_name_daily_question || t('nav_daily');
      case 'quiz':
        return t('nav_quiz');
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

  return (
    <nav className="flex flex-wrap gap-1.5" aria-label={t('nav_label')}>
      {ENTRIES.map((entry) => {
        const isActive = active === entry.view;
        return (
          <button
            key={entry.view}
            type="button"
            onClick={() => onNavigate(entry.view)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative inline-flex items-center gap-2 rounded-[var(--game-radius)] px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'text-[var(--game-accent)]'
                : 'text-[var(--game-text-muted)] hover:bg-[var(--game-surface)] hover:text-[var(--game-text)]'
            )}
          >
            {isActive && (
              <m.span
                layoutId="game-nav-active"
                className="absolute inset-0 rounded-[var(--game-radius)] bg-[var(--game-accent-muted)]"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 40 }
                }
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {entry.icon}
              <span>{labelFor(entry)}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
