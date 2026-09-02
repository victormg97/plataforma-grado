'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useShallowQueryParam } from '@/lib/hooks/useShallowQueryParam';
import {
  Settings,
  Star,
  Flame,
  CalendarCheck,
  Swords,
  Award,
  Scale,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Heart,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';
import { Tabs, tabId, tabPanelId, type TabItem } from '@/components/common/Tabs';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import { useGameSettings } from '@/lib/hooks/useComunidad';
import { GeneralTab } from './tabs/GeneralTab';
import { PointsTab } from './tabs/PointsTab';
import { StreakTab } from './tabs/StreakTab';
import { DailyQuestionTab } from './tabs/DailyQuestionTab';
import { ChallengesTab } from './tabs/ChallengesTab';
import { BadgesTab } from './tabs/BadgesTab';
import { WeeklyCaseTab } from './tabs/WeeklyCaseTab';
import { StatsTab } from './tabs/StatsTab';
import { DangerZoneTab } from './tabs/DangerZoneTab';
import { LevelsTab } from './tabs/LevelsTab';
import { LivesTab } from './tabs/LivesTab';
import { PlayersTab } from './tabs/PlayersTab';

type TabKey =
  | 'general'
  | 'points'
  | 'streak'
  | 'levels'
  | 'lives'
  | 'daily'
  | 'challenges'
  | 'badges'
  | 'weekly-case'
  | 'players'
  | 'stats'
  | 'danger';

const TAB_KEYS: TabKey[] = ['general', 'points', 'streak', 'levels', 'lives', 'daily', 'challenges', 'badges', 'weekly-case', 'players', 'stats', 'danger'];

/**
 * Comunidad Estratégica admin panel (Req. 9). Tab navigation persisted in ?tab=.
 * Client-side role guard as a safety net (the route already guards server-side).
 */
export function AdminPanel() {
  const t = useTranslations('comunidadEstrategica');
  const router = useRouter();
  const { user } = useUser();
  const { data: settings } = useGameSettings();

  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace(getRolRedirectPath(user.rol));
    }
  }, [user, router]);

  // Tab state lives in ?tab= but is updated shallowly (no RSC round-trip), so
  // switching tabs is instant and doesn't re-run the server-side prefetch.
  const [rawTab, setRawTab] = useShallowQueryParam('tab');
  const active: TabKey = rawTab && TAB_KEYS.includes(rawTab as TabKey) ? (rawTab as TabKey) : 'general';

  const setTab = (key: string) => setRawTab(key);

  if (!user || user.rol !== 'admin') return null;

  const tabs: TabItem[] = [
    { key: 'general', label: t('admin_tab_general'), icon: <Settings className="size-4" /> },
    { key: 'points', label: t('admin_tab_points'), icon: <Star className="size-4" /> },
    { key: 'streak', label: t('admin_tab_streak'), icon: <Flame className="size-4" /> },
    { key: 'levels', label: t('admin_tab_levels'), icon: <TrendingUp className="size-4" /> },
    { key: 'lives', label: t('admin_tab_lives'), icon: <Heart className="size-4" /> },
    { key: 'daily', label: t('admin_tab_daily'), icon: <CalendarCheck className="size-4" /> },
    { key: 'challenges', label: t('admin_tab_challenges'), icon: <Swords className="size-4" /> },
    { key: 'badges', label: t('admin_tab_badges'), icon: <Award className="size-4" /> },
    { key: 'weekly-case', label: t('admin_tab_weekly_case'), icon: <Scale className="size-4" /> },
    { key: 'players', label: t('admin_tab_players'), icon: <Users className="size-4" /> },
    { key: 'stats', label: t('admin_tab_stats'), icon: <BarChart3 className="size-4" /> },
    { key: 'danger', label: t('admin_tab_danger'), icon: <AlertTriangle className="size-4" /> },
  ];

  return (
    <div>
      <BackButton fallback="/admin" />

      <PageHeader
        title={settings?.display_name || t('admin_title')}
        subtitle={t('admin_subtitle')}
        className="mt-3"
      />

      <div className="mt-[var(--space-lg)]">
        <Tabs items={tabs} active={active} onChange={setTab} idPrefix="game-admin" aria-label={t('admin_title')} />
      </div>

      <div
        className="mt-[var(--space-lg)]"
        role="tabpanel"
        id={tabPanelId('game-admin', active)}
        aria-labelledby={tabId('game-admin', active)}
      >
        {active === 'general' && <GeneralTab />}
        {active === 'points' && <PointsTab />}
        {active === 'streak' && <StreakTab />}
        {active === 'levels' && <LevelsTab />}
        {active === 'lives' && <LivesTab />}
        {active === 'daily' && <DailyQuestionTab />}
        {active === 'challenges' && <ChallengesTab />}
        {active === 'badges' && <BadgesTab />}
        {active === 'weekly-case' && <WeeklyCaseTab />}
        {active === 'players' && <PlayersTab />}
        {active === 'stats' && <StatsTab />}
        {active === 'danger' && <DangerZoneTab />}
      </div>
    </div>
  );
}
