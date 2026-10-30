'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Crown,
  Flame,
  Hourglass,
  Scale,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDailyQuestion,
  useGameProfile,
  useGameSettings,
  useMonthlyRanking,
  useQuizSubjects,
} from '@/lib/hooks/useComunidad';
import { heroImageUrl } from '../heroImageUrl';
import { QuizItemIcon, quizToneStyle } from '../quiz/QuizItemIcon';
import { RankMedal } from '../ranking/RankMedal';
import { formatClock, msUntilSantiagoMidnight, useNow } from '../useNow';
import type { GameView } from '../views';

const STEPS = [
  { key: 'respond', Icon: Target, tone: ['var(--game-accent)', 'var(--game-header-bg)'] },
  { key: 'points', Icon: Star, tone: ['var(--game-rank-gold)', 'var(--game-rank-gold-dark)'] },
  { key: 'level', Icon: BarChart3, tone: ['var(--quiz-tone-sky)', 'var(--quiz-tone-indigo)'] },
  { key: 'best', Icon: Crown, tone: ['var(--game-fire-hot)', 'var(--game-fire-deep)'] },
] as const;

/** Entrance for the home blocks (staggered). */
function useEnter(i: number) {
  const reduceMotion = useReducedMotion();
  return {
    initial: reduceMotion ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: reduceMotion ? 0 : 0.05 + i * 0.07, ease: 'easeOut' as const },
  };
}

/**
 * Game home. A warm hero (greeting, level/streak chips, CTA with shine and a
 * floating hero image), a "how it works" path of four steps, and three live
 * cards: today's question (status + countdown), quizzes (subject icon stack)
 * and the monthly ranking (mini podium). All data comes from the bootstrap
 * cache: no extra requests.
 */
export function GameHome({ onNavigate }: { onNavigate: (view: GameView) => void }) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const { data: profile } = useGameProfile();
  const { data: settings } = useGameSettings();
  const heroUrl = heroImageUrl(settings?.hero_image_path);

  const level = profile?.level?.level ?? 1;
  const streak = profile?.current_streak ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hero ── */}
      <m.section
        {...useEnter(0)}
        className="relative isolate overflow-hidden rounded-[var(--game-radius)] bg-[var(--game-surface)] p-6 shadow-[var(--game-shadow)] sm:p-8"
      >
        {/* Soft decor */}
        <span aria-hidden className="game-anim-float absolute -right-16 -top-20 -z-10 size-64 rounded-full bg-[radial-gradient(circle,var(--game-accent-muted)_0%,transparent_70%)]" />
        <span aria-hidden className="absolute -bottom-24 left-1/3 -z-10 size-56 rounded-full bg-[radial-gradient(circle,var(--game-rank-gold-bg)_0%,transparent_70%)]" />

        <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--game-accent-muted)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--game-accent)]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-[var(--game-accent)] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--game-accent)]" />
              </span>
              {profile?.nickname ? t('home_greeting_named', { nickname: profile.nickname }) : t('home_hero_kicker')}
            </span>

            <h2 className="text-4xl font-extrabold leading-[1.05] text-[var(--game-accent)] sm:text-5xl lg:text-6xl">
              {t('title')}
            </h2>
            <p className="max-w-lg text-base leading-relaxed text-[var(--game-text-muted)] sm:text-lg">
              {t('home_hero_desc')}
            </p>

            {profile?.nickname && (
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--game-rank-gold-bg)] px-3 py-1 text-xs font-bold text-[var(--game-rank-gold-dark)]">
                  <BarChart3 className="size-3.5" />
                  {t('level_label')} {level}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
                    streak > 0 ? 'bg-[var(--game-fire-hot)]/15 text-[var(--game-fire-deep)]' : 'bg-[var(--game-surface-muted)] text-[var(--game-text-muted)]'
                  )}
                >
                  <Flame className={cn('size-3.5', streak > 0 && 'fill-[var(--game-flame-core)]')} />
                  {t('daily_hero_streak', { days: streak })}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate('daily')}
              className="group relative mt-1 inline-flex w-fit items-center gap-2 overflow-hidden rounded-[var(--game-radius-sm)] bg-[linear-gradient(135deg,var(--game-accent),var(--game-header-bg))] px-7 py-3.5 text-base font-bold text-white shadow-[0_14px_28px_-14px_var(--game-accent)] transition-transform hover:-translate-y-0.5"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/25 transition-all duration-700 group-hover:left-[120%] motion-reduce:hidden"
              />
              {t('home_hero_cta')}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          {/* Hero image (configurable) or the default trophy + scale */}
          <div className="hidden items-center justify-center md:flex">
            <span className={cn('inline-flex', !reduceMotion && 'game-anim-float')}>
              {heroUrl ? (
                <Image
                  src={heroUrl}
                  alt={t('home_hero_image_alt')}
                  width={520}
                  height={340}
                  className="h-auto max-h-80 w-full object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.18)]"
                  unoptimized
                />
              ) : (
                <span className="relative flex items-center justify-center gap-3">
                  <span aria-hidden className="absolute size-40 rounded-full bg-[radial-gradient(circle,var(--game-rank-gold-bg),transparent_70%)]" />
                  <Trophy className="relative size-20 text-[var(--game-gold)]" />
                  <Scale className="relative size-16 text-[var(--game-accent)]" />
                </span>
              )}
            </span>
          </div>
        </div>
      </m.section>

      {/* ── How it works: 4-step path ── */}
      <m.ol {...useEnter(1)} className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Dashed connector behind the steps (desktop) */}
        <span aria-hidden className="absolute left-[12%] right-[12%] top-[2.1rem] -z-0 hidden border-t-2 border-dashed border-[var(--game-border)] lg:block" />
        {STEPS.map((s, i) => (
          <m.li
            key={s.key}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.15 + i * 0.08 }}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            style={{ ['--step-tone' as string]: s.tone[0], ['--step-deep' as string]: s.tone[1] }}
            className="group relative flex flex-col gap-2 rounded-[var(--game-radius)] bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)]"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--step-tone),var(--step-deep))] text-white shadow-[0_8px_16px_-10px_var(--step-tone)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <s.Icon className="size-5" />
                <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--game-surface)] text-[10px] font-black text-[var(--step-tone)] ring-2 ring-[var(--step-tone)]">
                  {i + 1}
                </span>
              </span>
              <span className="font-bold text-[var(--game-text)]">{t(`feat_${s.key}_title`)}</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--game-text-muted)]">{t(`feat_${s.key}_desc`)}</p>
          </m.li>
        ))}
      </m.ol>

      {/* ── Live cards ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <TodayCard onNavigate={onNavigate} enter={useEnter(2)} />
        <QuizzesCard onNavigate={onNavigate} enter={useEnter(3)} />
        <RankingCard onNavigate={onNavigate} enter={useEnter(4)} />
      </div>
    </div>
  );
}

type Enter = ReturnType<typeof useEnter>;

/** Shell shared by the three live cards. */
function LiveCard({
  enter,
  tone,
  icon,
  title,
  subtitle,
  children,
  cta,
  onClick,
}: {
  enter: Enter;
  tone: [string, string];
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  cta: string;
  onClick: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <m.article
      {...enter}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      style={{ ['--card-tone' as string]: tone[0], ['--card-deep' as string]: tone[1] }}
      className="group relative isolate flex flex-col gap-4 overflow-hidden rounded-[var(--game-radius)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--card-tone),var(--card-deep))]" />
      <span aria-hidden className="absolute -right-14 -top-14 -z-10 size-40 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--card-tone)_14%,transparent),transparent_70%)] transition-transform duration-500 group-hover:scale-125" />

      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--card-tone),var(--card-deep))] text-white transition-transform duration-300 group-hover:-rotate-6">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight text-[var(--game-text)]">{title}</h3>
          <p className="text-xs text-[var(--game-text-muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1">{children}</div>

      <button
        type="button"
        onClick={onClick}
        className="inline-flex w-fit items-center gap-2 rounded-[var(--game-radius-sm)] bg-[linear-gradient(135deg,var(--card-tone),var(--card-deep))] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-12px_var(--card-tone)] transition-transform hover:-translate-y-0.5"
      >
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </button>
    </m.article>
  );
}

function TodayCard({ onNavigate, enter }: { onNavigate: (v: GameView) => void; enter: Enter }) {
  const t = useTranslations('comunidadEstrategica');
  const now = useNow(1000);
  const { data: daily } = useDailyQuestion();
  const { data: profile } = useGameProfile();

  const answered = !!daily?.already_answered;
  const hasQuestion = !!daily?.question;
  const atRisk = profile?.streak_status === 'at_risk';

  return (
    <LiveCard
      enter={enter}
      tone={['var(--game-gold)', 'var(--game-accent)']}
      icon={<CalendarCheck className="size-5" />}
      title={t('home_daily_cta_title')}
      subtitle={t('home_daily_cta_desc')}
      cta={answered ? t('home_today_review') : t('home_daily_cta_button')}
      onClick={() => onNavigate('daily')}
    >
      <div className="flex flex-col gap-2">
        {!hasQuestion ? (
          <p className="text-sm text-[var(--game-text-muted)]">{t('daily_empty')}</p>
        ) : answered ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--game-correct)]/12 px-3 py-1 text-sm font-bold text-[var(--game-correct)]">
            <CheckCircle2 className="size-4" />
            {t('home_today_done')}
          </span>
        ) : (
          <span
            className={cn(
              'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold',
              atRisk ? 'bg-[var(--game-fire-amber)] text-white motion-safe:animate-pulse' : 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
            )}
          >
            <Flame className="size-4" />
            {atRisk ? t('home_today_at_risk') : t('home_today_pending')}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--game-text-muted)]" suppressHydrationWarning>
          <Hourglass className="size-3.5" />
          {t('daily_next_in')} <b className="font-mono tabular-nums text-[var(--game-text)]">{formatClock(msUntilSantiagoMidnight(now))}</b>
        </span>
      </div>
    </LiveCard>
  );
}

function QuizzesCard({ onNavigate, enter }: { onNavigate: (v: GameView) => void; enter: Enter }) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const { data } = useQuizSubjects();
  const subjects = data?.subjects ?? [];
  const shown = subjects.slice(0, 5);
  const extra = subjects.length - shown.length;

  return (
    <LiveCard
      enter={enter}
      tone={['var(--game-accent)', 'var(--game-header-bg)']}
      icon={<QuizItemIcon fallback="book-open" className="size-5" />}
      title={t('subjects_title')}
      subtitle={t('subjects_subtitle')}
      cta={t('subjects_cta')}
      onClick={() => onNavigate('quiz')}
    >
      {subjects.length === 0 ? (
        <p className="text-sm text-[var(--game-text-muted)]">{t('quiz_no_subjects')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Overlapping stack of subject icons (fans out on hover) */}
          <div className="flex items-center">
            {shown.map((s, i) => (
              <m.span
                key={s.id}
                title={s.name}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.3 + i * 0.06 }}
                style={{ ...quizToneStyle(s.color_key), zIndex: shown.length - i }}
                className="-ml-2 flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--tone),var(--tone-deep))] text-white ring-2 ring-[var(--game-surface)] transition-[margin] duration-300 first:ml-0 group-hover:ml-1 group-hover:first:ml-0"
              >
                <QuizItemIcon iconKey={s.icon_key} imagePath={s.icon_image_path} fallback="book-open" className="size-5" />
              </m.span>
            ))}
            {extra > 0 && (
              <span className="-ml-2 flex size-10 items-center justify-center rounded-xl bg-[var(--game-surface-muted)] text-xs font-bold text-[var(--game-text-muted)] ring-2 ring-[var(--game-surface)] transition-[margin] duration-300 group-hover:ml-1">
                +{extra}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--game-text-muted)]">
            {t('home_quiz_subjects', { count: subjects.length })}
          </p>
        </div>
      )}
    </LiveCard>
  );
}

function RankingCard({ onNavigate, enter }: { onNavigate: (v: GameView) => void; enter: Enter }) {
  const t = useTranslations('comunidadEstrategica');
  const { data } = useMonthlyRanking(null);
  const page = data?.pages[0];
  const top = (page?.entries ?? []).slice(0, 3);
  const me = page?.my_position;

  return (
    <LiveCard
      enter={enter}
      tone={['var(--game-rank-gold)', 'var(--game-rank-gold-dark)']}
      icon={<Trophy className="size-5" />}
      title={t('ranking_title')}
      subtitle={t('ranking_home_subtitle')}
      cta={t('ranking_home_cta')}
      onClick={() => onNavigate('ranking')}
    >
      {top.length === 0 ? (
        <p className="text-sm text-[var(--game-text-muted)]">{t('ranking_empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1.5">
            {top.map((e) => (
              <li key={e.user_id} className="flex items-center gap-2">
                <RankMedal position={e.position} size={e.position === 1 ? 30 : 26} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--game-text)]">
                  {e.display_name || e.nickname || t('ranking_anonymous')}
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--game-rank-gold-dark)]">
                  {t('ranking_points', { points: e.points })}
                </span>
              </li>
            ))}
          </ul>
          {me?.has_position && (
            <p className="text-xs text-[var(--game-text-muted)]">
              {t('home_ranking_you', { position: me.position ?? 0 })}
            </p>
          )}
        </div>
      )}
    </LiveCard>
  );
}
