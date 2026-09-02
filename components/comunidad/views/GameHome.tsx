'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Target,
  Star,
  BarChart3,
  Crown,
  BookOpen,
  Trophy,
  Scale,
} from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useGameProfile } from '@/lib/hooks/useComunidad';
import type { GameView } from '../views';

/**
 * Game Home (Portada) — initial active view, styled after mockup 1.
 *
 * Live in Slice 1: the "Comenzar a jugar" CTA (goes to the Daily Question)
 * and the streak-based greeting. The "Materias disponibles" and "Ranking
 * Semanal" blocks are VISUAL PLACEHOLDERS for later slices (no logic).
 */
export function GameHome({ onNavigate }: { onNavigate: (view: GameView) => void }) {
  const t = useTranslations('comunidadEstrategica');
  const { data: profile } = useGameProfile();

  const features = [
    { icon: <Target className="size-6" />, title: t('feat_respond_title'), desc: t('feat_respond_desc') },
    { icon: <Star className="size-6" />, title: t('feat_points_title'), desc: t('feat_points_desc') },
    { icon: <BarChart3 className="size-6" />, title: t('feat_level_title'), desc: t('feat_level_desc') },
    { icon: <Crown className="size-6" />, title: t('feat_best_title'), desc: t('feat_best_desc') },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <Card padding="lg" className="overflow-hidden border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
        <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-[var(--game-text-muted)]">
              {t('home_hero_kicker')}
            </span>
            <h2 className="text-3xl font-extrabold leading-tight text-[var(--game-accent)]">
              {t('title')}
            </h2>
            <p className="max-w-md text-sm text-[var(--game-text-muted)]">
              {t('home_hero_desc')}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('daily')}
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-6 py-3 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
            >
              {t('home_hero_cta')}
              <ArrowRight className="size-4" />
            </button>
          </div>

          {/* Decorative illustration stand-in */}
          <div className="hidden items-center justify-center gap-3 md:flex">
            <Trophy className="size-16 text-[var(--game-gold)]" />
            <Scale className="size-14 text-[var(--game-accent)]" />
          </div>
        </div>
      </Card>

      {/* Feature strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card
            key={f.title}
            padding="md"
            className="flex flex-col gap-2 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]"
          >
            <div className="text-[var(--game-accent)]">{f.icon}</div>
            <div className="font-semibold text-[var(--game-accent)]">{f.title}</div>
            <p className="text-xs text-[var(--game-text-muted)]">{f.desc}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Cuestionarios por materia — acceso real (Slice 2) */}
        <Card padding="lg" className="flex flex-col justify-between gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="size-6 text-[var(--game-accent)]" />
              <h3 className="text-lg font-bold text-[var(--game-accent)]">{t('subjects_title')}</h3>
            </div>
            <p className="text-sm text-[var(--game-text-muted)]">{t('subjects_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('quiz')}
            className="inline-flex w-fit items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
          >
            {t('subjects_cta')}
            <ArrowRight className="size-4" />
          </button>
        </Card>

        {/* Ranking mensual — acceso real (Slice 2) */}
        <Card padding="lg" className="flex flex-col justify-between gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Trophy className="size-6 text-[var(--game-gold)]" />
              <h3 className="text-lg font-bold text-[var(--game-accent)]">{t('ranking_title')}</h3>
            </div>
            <p className="text-sm text-[var(--game-text-muted)]">{t('ranking_home_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ranking')}
            className="inline-flex w-fit items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
          >
            {t('ranking_home_cta')}
            <ArrowRight className="size-4" />
          </button>
        </Card>
      </div>

      {/* Quick access to today's question (kept for players past onboarding) */}
      {profile?.nickname && (
        <Card padding="md" className="flex items-center justify-between border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div>
            <div className="font-semibold text-[var(--game-accent)]">{t('home_daily_cta_title')}</div>
            <p className="text-xs text-[var(--game-text-muted)]">{t('home_daily_cta_desc')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('daily')}
            className="inline-flex items-center gap-2 rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)]"
          >
            {t('home_daily_cta_button')}
          </button>
        </Card>
      )}
    </div>
  );
}
