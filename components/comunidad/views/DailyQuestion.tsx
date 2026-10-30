'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarX2, Check, HeartCrack, Quote } from 'lucide-react';
import { GameRichText } from '../GameRichText';
import { cn } from '@/lib/utils';
import { useDailyQuestion, useAnswerDailyQuestion, useDailyReview, useGameProfile } from '@/lib/hooks/useComunidad';
import { RecentAchievements } from '../RecentAchievements';
import { LevelCard } from '../LevelCard';
import { DailyReviewPanel } from '../DailyReviewPanel';
import { ChoiceModeBadge } from '../quiz/ChoiceModeBadge';
import { DailyHero } from '../daily/DailyHero';
import type { DailyAnswer, DailyAnswerResult } from '@/lib/comunidad/answer';
import type { GameView } from '../views';
import { useUserStore } from '@/stores/useUserStore';
import { playerKey, readPlayerItem, removePlayerItem, writePlayerItem } from '@/lib/comunidad/player-storage';

// Types the Pregunta del Día can render and grade.
const SUPPORTED_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false']);

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface DailyDraft {
  questionId: string;
  selected: number[];
  tfValue: boolean | null;
}

/**
 * Pregunta del Día: a calendar-style hero (date, streak hook, countdown to the
 * next question), the question on a "card of the day" with big tappable
 * options, and the player's level + recent achievements on the side.
 */
export function DailyQuestion({
  onAnswered,
  onNavigate,
}: {
  onAnswered: (result: DailyAnswerResult) => void;
  onNavigate?: (view: GameView) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const reduceMotion = useReducedMotion();
  const { data, isLoading } = useDailyQuestion();
  const { data: profile } = useGameProfile();
  const { data: review } = useDailyReview(!!data?.already_answered);
  const mutation = useAnswerDailyQuestion();

  const userId = useUserStore((s) => s.user?.id ?? null);
  const draftKey = userId ? playerKey(userId, 'daily-draft') : null;
  const questionId = data?.question?.id ?? null;

  const [selected, setSelected] = useState<number[]>([]);
  const [tfValue, setTfValue] = useState<boolean | null>(null);

  // Restore the selection made before a reload (same question only).
  useEffect(() => {
    if (!draftKey || !questionId) return;
    const draft = readPlayerItem<DailyDraft>(draftKey, { kind: 'session' });
    if (!draft || draft.questionId !== questionId) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from storage */
    setSelected(draft.selected ?? []);
    setTfValue(draft.tfValue ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftKey, questionId]);

  // Keep the draft in sync with the selection.
  useEffect(() => {
    if (!draftKey || !questionId) return;
    if (selected.length === 0 && tfValue === null) return;
    writePlayerItem<DailyDraft>(draftKey, { questionId, selected, tfValue }, 'session');
  }, [draftKey, questionId, selected, tfValue]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5" role="status" aria-label={t('loading')}>
        <div className="h-36 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]" />
        <div className="h-72 animate-pulse rounded-[var(--game-radius)] bg-[var(--game-surface)] shadow-[var(--game-shadow)]" />
      </div>
    );
  }

  const question = data?.question ?? null;

  // No question, or a type this screen can't grade (e.g. matching curated by
  // mistake): show the empty state instead of a broken true/false form.
  if (!question || !SUPPORTED_TYPES.has(question.type)) {
    return (
      <div className="flex flex-col gap-5">
        <DailyHero />
        <EmptyCard icon={<CalendarX2 className="size-8" />} text={t('daily_empty')} />
      </div>
    );
  }

  if (data?.already_answered) {
    return (
      <div className="flex flex-col gap-5">
        <DailyHero answered correct={review?.answered ? !!review.is_correct : null} />
        <p className="text-center text-sm font-medium text-[var(--game-text-muted)]">{t('daily_already_answered')}</p>
        <DailyReviewPanel />
      </div>
    );
  }

  // No lives left (and the tenant blocks play when empty): show a notice.
  if (profile?.lives?.enabled && profile.lives.block_when_empty && (profile.lives.current ?? 0) <= 0) {
    return (
      <div className="flex flex-col gap-5">
        <DailyHero />
        <EmptyCard icon={<HeartCrack className="size-8" />} text={t('lives_none_message')} />
      </div>
    );
  }

  const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice';
  const isMulti = question.type === 'multiple_choice';
  const options = Array.isArray(question.options) ? question.options : [];

  const toggleChoice = (idx: number) => {
    if (isMulti) {
      setSelected((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
    } else {
      setSelected([idx]);
    }
  };

  const canSubmit = isChoice ? selected.length > 0 : tfValue !== null;

  const handleSubmit = () => {
    const payload: DailyAnswer = isChoice ? { selected } : { value: tfValue as boolean };
    mutation.mutate(payload, {
      onSuccess: (result) => {
        if (draftKey) removePlayerItem(draftKey, 'session');
        onAnswered(result);
      },
    });
  };

  const choiceItems = isChoice
    ? options.map((opt, idx) => ({
        key: String(idx),
        label: opt.text,
        marker: LETTERS[idx] ?? String(idx + 1),
        active: selected.includes(idx),
        onClick: () => toggleChoice(idx),
      }))
    : [
        { key: 'true', label: t('daily_true'), marker: 'V', active: tfValue === true, onClick: () => setTfValue(true) },
        { key: 'false', label: t('daily_false'), marker: 'F', active: tfValue === false, onClick: () => setTfValue(false) },
      ];

  return (
    <div className="flex flex-col gap-5">
      <DailyHero />

      <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Card of the day */}
        <m.section
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[var(--game-radius)] border-t-4 border-[var(--game-gold)] bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)] sm:p-6"
        >
          <Quote
            aria-hidden
            className="absolute -right-2 -top-2 -z-10 size-28 rotate-180 text-[var(--game-accent-muted)]"
          />
          <GameRichText html={question.content} variant="question" />

          {isChoice && <ChoiceModeBadge multiple={isMulti} selectedCount={selected.length} />}

          <div
            className={cn('grid gap-3', !isChoice && 'sm:grid-cols-2')}
            role={isMulti ? 'group' : 'radiogroup'}
            aria-label={t('daily_options_label')}
          >
            {choiceItems.map((o, i) => (
              <m.button
                key={o.key}
                type="button"
                role={isMulti ? 'checkbox' : 'radio'}
                aria-checked={o.active}
                onClick={o.onClick}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.08 + i * 0.05 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className={cn(
                  'group flex items-center gap-3 rounded-[var(--game-radius-sm)] border-2 px-4 py-3.5 text-left text-sm font-medium transition-all',
                  o.active
                    ? 'border-[var(--game-accent)] bg-[var(--game-option-selected-bg)] text-[var(--game-text)] shadow-[0_8px_18px_-12px_var(--game-accent)]'
                    : 'border-transparent bg-[var(--game-surface-muted)] text-[var(--game-text)] hover:-translate-y-0.5 hover:border-[var(--game-accent)]/30'
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center text-sm font-black transition-colors',
                    isMulti ? 'rounded-md border-2' : 'rounded-full',
                    isMulti && (o.active ? 'border-[var(--game-accent)]' : 'border-[var(--game-accent)]/40'),
                    o.active
                      ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
                      : 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
                  )}
                >
                  {isMulti && o.active ? <Check className="size-4" /> : o.marker}
                </span>
                <span className="flex-1">{o.label}</span>
              </m.button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || mutation.isPending}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-[var(--game-radius-sm)] bg-[linear-gradient(135deg,var(--game-accent),var(--game-header-bg))] py-3.5 text-base font-bold text-white shadow-[0_12px_24px_-14px_var(--game-accent)] transition-all hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
          >
            {mutation.isPending ? t('daily_submitting') : t('daily_submit')}
            {!mutation.isPending && <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />}
          </button>

          {mutation.isError && (
            <p className="text-sm text-[var(--game-incorrect)]" role="alert">
              {(() => {
                const code = (mutation.error as { message?: string })?.message;
                if (code === 'NO_LIVES') return t('lives_none_message');
                if (code === 'PLAYER_BANNED') return t('banned_short');
                return t('daily_submit_error');
              })()}
            </p>
          )}
        </m.section>

        {/* Side column — real level + recent achievements */}
        <div className="flex flex-col gap-4">
          <LevelCard level={profile?.level} />
          <RecentAchievements onSeeMore={onNavigate ? () => onNavigate('badges') : undefined} />
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--game-radius)] border-2 border-dashed border-[var(--game-border)] bg-[var(--game-surface)] px-6 py-12 text-center">
      <span className="game-anim-float flex size-16 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-accent)]">
        {icon}
      </span>
      <p className="max-w-sm text-sm text-[var(--game-text-muted)]">{text}</p>
    </div>
  );
}
