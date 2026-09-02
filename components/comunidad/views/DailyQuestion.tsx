'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import { Scale } from 'lucide-react';
import { useDailyQuestion, useAnswerDailyQuestion, useGameProfile } from '@/lib/hooks/useComunidad';
import { RecentAchievements } from '../RecentAchievements';
import type { DailyAnswer, DailyAnswerResult } from '@/lib/comunidad/answer';
import type { GameView } from '../views';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Daily Question screen, styled after mockup 2. The right column shows the
 * player's real level and recent achievements.
 */
export function DailyQuestion({
  onAnswered,
  onNavigate,
}: {
  onAnswered: (result: DailyAnswerResult) => void;
  onNavigate?: (view: GameView) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading } = useDailyQuestion();
  const { data: profile } = useGameProfile();
  const mutation = useAnswerDailyQuestion();

  const [selected, setSelected] = useState<number[]>([]);
  const [tfValue, setTfValue] = useState<boolean | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
      </div>
    );
  }

  const question = data?.question ?? null;

  if (!question) {
    return (
      <Card padding="lg" className="border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]">
        <p className="text-sm text-[var(--game-text-muted)]">{t('daily_empty')}</p>
      </Card>
    );
  }

  if (data?.already_answered) {
    return (
      <Card padding="lg" className="border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]">
        <p className="text-sm text-[var(--game-text-muted)]">{t('daily_already_answered')}</p>
      </Card>
    );
  }

  // No lives left (and the tenant blocks play when empty): show a notice.
  if (profile?.lives?.enabled && profile.lives.block_when_empty && (profile.lives.current ?? 0) <= 0) {
    return (
      <Card padding="lg" className="border-none bg-[var(--game-surface)] text-center shadow-[var(--game-shadow)]">
        <p className="text-sm text-[var(--game-text-muted)]">{t('lives_none_message')}</p>
      </Card>
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
    mutation.mutate(payload, { onSuccess: (result) => onAnswered(result) });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* Main question card */}
      <Card padding="lg" className="flex flex-col gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
        {/* Subject pill — placeholder tag until subjects are wired (later slice) */}
        <span className="w-fit rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] px-4 py-1.5 text-sm font-semibold text-[var(--game-on-accent)]">
          {t('daily_subject_placeholder')}
        </span>

        <div
          className="prose prose-sm max-w-none font-medium text-[var(--game-text)]"
          dangerouslySetInnerHTML={{ __html: question.content }}
        />

        {isChoice ? (
          <div
            className="flex flex-col gap-3"
            role={isMulti ? 'group' : 'radiogroup'}
            aria-label={t('daily_options_label')}
          >
            {options.map((opt, idx) => {
              const active = selected.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  role={isMulti ? 'checkbox' : 'radio'}
                  aria-checked={active}
                  onClick={() => toggleChoice(idx)}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--game-radius-sm)] border px-4 py-3 text-left text-sm transition-colors',
                    active
                      ? 'border-[var(--game-accent)] bg-[var(--game-option-selected-bg)] text-[var(--game-text)]'
                      : 'border-transparent bg-[var(--game-surface-muted)] text-[var(--game-text)] hover:bg-[var(--game-accent-muted)]'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      active
                        ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
                        : 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
                    )}
                  >
                    {LETTERS[idx] ?? idx + 1}
                  </span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className="flex flex-col gap-3"
            role="radiogroup"
            aria-label={t('daily_options_label')}
          >
            {[
              { label: t('daily_true'), value: true, letter: 'A' },
              { label: t('daily_false'), value: false, letter: 'B' },
            ].map((o) => {
              const active = tfValue === o.value;
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTfValue(o.value)}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--game-radius-sm)] border px-4 py-3 text-left text-sm transition-colors',
                    active
                      ? 'border-[var(--game-accent)] bg-[var(--game-option-selected-bg)] text-[var(--game-text)]'
                      : 'border-transparent bg-[var(--game-surface-muted)] text-[var(--game-text)] hover:bg-[var(--game-accent-muted)]'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      active
                        ? 'bg-[var(--game-accent)] text-[var(--game-on-accent)]'
                        : 'bg-[var(--game-accent-muted)] text-[var(--game-accent)]'
                    )}
                  >
                    {o.letter}
                  </span>
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {isMulti && <p className="text-xs text-[var(--game-text-muted)]">{t('daily_multi_hint')}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
          className="mt-1 w-full rounded-[var(--game-radius-sm)] bg-[var(--game-accent)] py-3 text-sm font-semibold text-[var(--game-on-accent)] transition-colors hover:bg-[var(--game-accent-hover)] disabled:pointer-events-none disabled:opacity-50"
        >
          {mutation.isPending ? t('daily_submitting') : t('daily_submit')}
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
      </Card>

      {/* Side column — real level + recent achievements */}
      <div className="flex flex-col gap-4">
        <Card padding="lg" className="flex items-center gap-4 border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--game-accent)] text-[var(--game-on-accent)]">
            <Scale className="size-7" />
          </div>
          <div>
            <div className="text-sm text-[var(--game-text-muted)]">{t('level_label')}</div>
            <div className="text-xl font-bold text-[var(--game-gold)]">{profile?.level?.level ?? 1}</div>
            {typeof profile?.level?.next_min === 'number' && (
              <div className="text-[11px] text-[var(--game-text-muted)]">
                {t('level_xp_to_next', {
                  points: Math.max((profile.level.next_min ?? 0) - (profile.level.xp ?? 0), 0),
                })}
              </div>
            )}
          </div>
        </Card>

        <RecentAchievements onSeeMore={onNavigate ? () => onNavigate('badges') : undefined} />
      </div>
    </div>
  );
}
