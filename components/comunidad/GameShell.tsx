'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useShallowQueryParam } from '@/lib/hooks/useShallowQueryParam';
import { Modal } from '@/components/common/Modal';
import { GameNav } from './GameNav';
import { GameHeader } from './GameHeader';
import { GameNavGuardProvider, useGameNavGuard } from './GameNavGuard';
import { BannedNotice } from './BannedNotice';
import { isGameView, type GameView } from './views';
import { GameHome } from './views/GameHome';
import { StreakView } from './views/StreakView';
import { NicknameOnboarding } from './views/NicknameOnboarding';
import { DailyQuestion } from './views/DailyQuestion';
import { DailyResult } from './views/DailyResult';
import { QuizView } from './views/QuizView';
import { RankingView } from './views/RankingView';
import { ChallengesView } from './views/ChallengesView';
import { BadgeShowcaseView } from './views/BadgeShowcaseView';
import { WeeklyCaseView } from './views/WeeklyCaseView';
import { useGameProfile, useGameSettings } from '@/lib/hooks/useComunidad';
import type { DailyAnswerResult } from '@/lib/comunidad/answer';

/**
 * Internal router of the mini-app. A single "active view" (persisted in the
 * URL via ?v=) identifies exactly one visible screen. Enforces the nickname
 * onboarding guard before the daily question, and keeps navigation decoupled
 * from visual rules. Navigation is routed through a NavGuard so views with
 * unsaved changes (e.g. the quiz in progress) can prompt before leaving.
 */
export function GameShell() {
  const t = useTranslations('comunidadEstrategica');
  const [viewParam, setViewParam] = useShallowQueryParam('v');
  const { data: settings } = useGameSettings();
  const { data: profile, isLoading: profileLoading } = useGameProfile();

  // Last daily-question result, surfaced by the result view.
  const [lastResult, setLastResult] = useState<DailyAnswerResult | null>(null);

  // Pending navigation awaiting confirmation (unsaved-changes guard).
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requested: GameView = isGameView(viewParam) ? viewParam : 'home';
  const hasNickname = !!profile?.nickname;

  // Guard: force onboarding before daily/result when there's no nickname.
  const active: GameView = useMemo(() => {
    if (
      !hasNickname &&
      (requested === 'daily' || requested === 'daily-result' || requested === 'quiz')
    ) {
      return 'onboarding';
    }
    return requested;
  }, [hasNickname, requested]);

  const doNavigate = useCallback(
    (view: GameView) => {
      setViewParam(view === 'home' ? null : view);
    },
    [setViewParam]
  );

  const onConfirmNeeded = useCallback((proceed: () => void) => {
    pendingActionRef.current = proceed;
    setConfirmOpen(true);
  }, []);

  const confirmLeave = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setConfirmOpen(false);
    action?.();
  }, []);

  const cancelLeave = useCallback(() => {
    pendingActionRef.current = null;
    setConfirmOpen(false);
  }, []);

  const renderView = (navigate: (view: GameView) => void) => {
    switch (active) {
      case 'home':
        return <GameHome onNavigate={navigate} />;
      case 'onboarding':
        return <NicknameOnboarding onDone={() => navigate('daily')} />;
      case 'daily':
        return (
          <DailyQuestion
            onAnswered={(result) => {
              setLastResult(result);
              navigate('daily-result');
            }}
            onNavigate={navigate}
          />
        );
      case 'daily-result':
        return <DailyResult result={lastResult} onNavigate={navigate} />;
      case 'streak':
        return <StreakView />;
      case 'quiz':
        return <QuizView />;
      case 'ranking':
        return <RankingView />;
      case 'challenges':
        return <ChallengesView />;
      case 'badges':
        return <BadgeShowcaseView />;
      case 'weekly-case':
        return <WeeklyCaseView />;
      default:
        return <GameHome onNavigate={navigate} />;
    }
  };

  return (
    <GameNavGuardProvider onConfirmNeeded={onConfirmNeeded}>
      <GameShellInner
        settings={settings}
        profile={profile}
        profileLoading={profileLoading}
        active={active}
        doNavigate={doNavigate}
        renderView={renderView}
      />

      <Modal open={confirmOpen} onClose={cancelLeave} title={t('leave_confirm_title')}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{t('leave_confirm_desc')}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelLeave}
              className="rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              {t('leave_confirm_stay')}
            </button>
            <button
              type="button"
              onClick={confirmLeave}
              className="rounded-[var(--radius-md)] bg-[var(--color-error)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t('leave_confirm_leave')}
            </button>
          </div>
        </div>
      </Modal>
    </GameNavGuardProvider>
  );
}

/**
 * Inner shell that consumes the nav guard. Navigation through GameNav (and any
 * view-provided navigate) is routed via guardedRun so an active blocker prompts
 * for confirmation first.
 */
function GameShellInner({
  settings,
  profile,
  profileLoading,
  active,
  doNavigate,
  renderView,
}: {
  settings: ReturnType<typeof useGameSettings>['data'];
  profile: ReturnType<typeof useGameProfile>['data'];
  profileLoading: boolean;
  active: GameView;
  doNavigate: (view: GameView) => void;
  renderView: (navigate: (view: GameView) => void) => React.ReactNode;
}) {
  const t = useTranslations('comunidadEstrategica');
  const { guardedRun } = useGameNavGuard();
  const reduceMotion = useReducedMotion();

  const navigate = useCallback(
    (view: GameView) => guardedRun(() => doNavigate(view)),
    [guardedRun, doNavigate]
  );

  const isBanned = !!profile?.moderation?.is_banned;

  // Subtle enter/exit for view changes. The data is already warm, so this is
  // pure polish and adds no load time. Respects prefers-reduced-motion.
  const variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      };

  return (
    <div className="flex flex-col gap-5 text-[var(--game-text)]">
      <GameHeader
        settings={settings}
        nickname={profile?.nickname ?? null}
        currentStreak={profile?.current_streak ?? 0}
        lives={profile?.lives}
        level={profile?.level}
      />

      {/* Restricted players can keep playing, but their nickname is hidden
          from others until they change it. */}
      {active !== 'onboarding' && !isBanned && profile?.moderation?.is_restricted && (
        <div
          className="rounded-[var(--game-radius-sm)] border border-[var(--game-incorrect)]/40 bg-[var(--game-surface-muted)] px-4 py-3 text-sm text-[var(--game-text)]"
          role="alert"
        >
          {t('restricted_notice')}
        </div>
      )}

      {/* Onboarding is a full-screen gate; hide nav until nickname is set.
          Banned players see only the ban notice (no nav, no gameplay). */}
      {active !== 'onboarding' && !isBanned && (
        <GameNav active={active} onNavigate={navigate} settings={settings} />
      )}

      <section>
        {profileLoading && active !== 'onboarding' ? (
          <div
            className="flex justify-center py-16"
            role="status"
            aria-live="polite"
            aria-label={t('loading')}
          >
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--game-accent)] border-t-transparent" />
          </div>
        ) : isBanned ? (
          <BannedNotice reason={profile?.moderation?.ban_reason ?? null} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={active}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {renderView(navigate)}
            </m.div>
          </AnimatePresence>
        )}
      </section>
    </div>
  );
}
