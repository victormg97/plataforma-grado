'use client';

import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { Layers, ListChecks, Play, Shuffle, Trophy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuizItemIcon, quizToneStyle, quizIconUrl } from './QuizItemIcon';

export interface QuizTileDisplay {
  name: string;
  description?: string | null;
  iconKey?: string | null;
  imagePath?: string | null;
  colorKey?: string | null;
}

/** Entrance stagger shared by the pickers. */
function useEnter(index: number) {
  const reduceMotion = useReducedMotion();
  return {
    initial: reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.28, delay: reduceMotion ? 0 : Math.min(index, 12) * 0.05, ease: 'easeOut' as const },
    whileHover: reduceMotion ? undefined : { y: -4 },
    whileTap: reduceMotion ? undefined : { scale: 0.98 },
  };
}

/** Icon inside a frosted badge; uploaded images get a white plate for contrast. */
function TileBadge({ item, fallback, size = 'lg' }: { item: QuizTileDisplay; fallback: 'book-open' | 'layers'; size?: 'lg' | 'md' }) {
  const hasImage = !!quizIconUrl(item.imagePath);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center ring-1 ring-white/25',
        size === 'lg' ? 'size-14 rounded-2xl' : 'size-12 rounded-xl',
        hasImage ? 'bg-white/95 p-1.5' : 'bg-white/15 backdrop-blur-sm'
      )}
    >
      <QuizItemIcon
        iconKey={item.iconKey}
        imagePath={item.imagePath}
        fallback={fallback}
        className={hasImage ? 'size-full' : size === 'lg' ? 'size-7' : 'size-6'}
      />
    </span>
  );
}

/** Decorative layers of the colored tiles (gradient, bubbles, shine). */
function TileBackdrop({ item, fallback }: { item: QuizTileDisplay; fallback: 'book-open' | 'layers' | 'shuffle' }) {
  return (
    <>
      <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,var(--tone)_0%,var(--tone-deep)_100%)]" />
      <span aria-hidden className="absolute -right-10 -top-10 -z-10 size-36 rounded-full bg-white/10" />
      <span aria-hidden className="absolute -bottom-12 right-16 -z-10 size-28 rounded-full bg-white/[0.06]" />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-5 -right-4 -z-10 size-28 rotate-[-12deg] text-white opacity-[0.14] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110"
      >
        {fallback === 'shuffle' ? (
          <Shuffle className="size-full" />
        ) : (
          <QuizItemIcon iconKey={item.iconKey} imagePath={item.imagePath} fallback={fallback} className="size-full" />
        )}
      </span>
      {/* Shine sweep on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/20 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100 motion-reduce:hidden"
      />
    </>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', className)}>
      {children}
    </span>
  );
}

/** Big colored "level select" tile for a subject. */
export function SubjectTile({
  item,
  questionCount,
  categoryCount = 0,
  playedCount = 0,
  index = 0,
  onClick,
}: {
  item: QuizTileDisplay;
  questionCount: number;
  categoryCount?: number;
  playedCount?: number;
  index?: number;
  onClick?: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const motion = useEnter(index);

  return (
    <m.button
      type="button"
      onClick={onClick}
      {...motion}
      style={quizToneStyle(item.colorKey)}
      className="group relative isolate flex min-h-[176px] flex-col overflow-hidden rounded-[var(--game-radius,1rem)] p-5 text-left text-white shadow-[0_16px_32px_-18px_var(--tone)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--tone-soft)]"
    >
      <TileBackdrop item={item} fallback="book-open" />

      <div className="flex items-start justify-between gap-2">
        <TileBadge item={item} fallback="book-open" />
        {playedCount > 0 && (
          <Chip className="bg-black/20 text-white">
            <Trophy className="size-3.5" />
            {t('quiz_played_times', { count: playedCount })}
          </Chip>
        )}
      </div>

      <div className="mt-4">
        <div className="text-lg font-extrabold leading-tight drop-shadow-sm">{item.name}</div>
        {item.description && <p className="mt-1 line-clamp-2 text-sm text-white/85">{item.description}</p>}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <Chip className="bg-white/15 text-white">
          <ListChecks className="size-3.5" />
          {t('quiz_subject_count', { count: questionCount })}
        </Chip>
        {categoryCount > 0 && (
          <Chip className="bg-white/15 text-white">
            <Layers className="size-3.5" />
            {t('quiz_category_count', { count: categoryCount })}
          </Chip>
        )}
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--tone-deep)] shadow-sm transition-transform group-hover:translate-x-0.5">
          <Play className="size-3.5 fill-current" />
          {t('quiz_play')}
        </span>
      </div>
    </m.button>
  );
}

/** Wide featured tile: play the whole subject (all categories mixed). */
export function AllCategoriesTile({
  subject,
  questionCount,
  onClick,
}: {
  subject: QuizTileDisplay;
  questionCount: number;
  onClick?: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const motion = useEnter(0);

  return (
    <m.button
      type="button"
      onClick={onClick}
      {...motion}
      style={quizToneStyle(subject.colorKey)}
      className="group relative isolate col-span-full flex items-center gap-4 overflow-hidden rounded-[var(--game-radius,1rem)] p-5 text-left text-white shadow-[0_16px_32px_-18px_var(--tone)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--tone-soft)]"
    >
      <TileBackdrop item={subject} fallback="shuffle" />
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
        <Shuffle className="size-7" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-extrabold leading-tight">{t('quiz_category_all')}</div>
        <p className="mt-0.5 text-sm text-white/85">{t('quiz_category_all_desc', { subject: subject.name })}</p>
        <Chip className="mt-2 bg-white/15 text-white">
          <ListChecks className="size-3.5" />
          {t('quiz_subject_count', { count: questionCount })}
        </Chip>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-[var(--tone-deep)] shadow-sm transition-transform group-hover:translate-x-0.5">
        <Play className="size-4 fill-current" />
        {t('quiz_play')}
      </span>
    </m.button>
  );
}

/** Category tile: light card with a colored icon badge and accent edge. */
export function CategoryTile({
  item,
  fallbackColorKey,
  questionCount,
  playedCount = 0,
  index = 0,
  onClick,
}: {
  item: QuizTileDisplay;
  /** Categories without their own color follow the subject's. */
  fallbackColorKey?: string | null;
  questionCount: number;
  playedCount?: number;
  index?: number;
  onClick?: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const motion = useEnter(index + 1);
  const hasImage = !!quizIconUrl(item.imagePath);

  return (
    <m.button
      type="button"
      onClick={onClick}
      {...motion}
      style={quizToneStyle(item.colorKey ?? fallbackColorKey)}
      className="group relative flex items-center gap-3 overflow-hidden rounded-[var(--game-radius,1rem)] border border-[var(--game-border,var(--color-border))] bg-[var(--game-surface,var(--color-bg))] p-4 pl-5 text-left shadow-[var(--game-shadow)] outline-none transition-colors hover:border-[var(--tone)] focus-visible:ring-2 focus-visible:ring-[var(--tone)]"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--tone),var(--tone-deep))]" />
      <span
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110',
          hasImage ? 'bg-white p-1.5 ring-1 ring-[var(--tone-soft)]' : 'bg-[var(--tone-soft)] text-[var(--tone)]'
        )}
      >
        <QuizItemIcon
          iconKey={item.iconKey}
          imagePath={item.imagePath}
          fallback="layers"
          className={hasImage ? 'size-full' : 'size-6'}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-[var(--game-text,var(--color-text-primary))]">{item.name}</div>
        {item.description && (
          <p className="line-clamp-1 text-xs text-[var(--game-text-muted,var(--color-text-muted))]">{item.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--game-text-muted,var(--color-text-muted))]">
          <span>{t('quiz_subject_count', { count: questionCount })}</span>
          {playedCount > 0 && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--game-correct,var(--quiz-tone-emerald))]">
              <CheckCircle2 className="size-3.5" />
              {t('quiz_played_times', { count: playedCount })}
            </span>
          )}
        </div>
      </div>
      {/* Always visible on touch; revealed on hover with a pointer. */}
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--tone)] text-white shadow-sm transition-all sm:-translate-x-1 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
        <Play className="size-4 fill-current" />
      </span>
    </m.button>
  );
}
