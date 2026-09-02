'use client';

import { useTranslations } from 'next-intl';
import { Users, CalendarCheck, BookOpen, Flame, Trophy, Award } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/common/Card';
import { useGameStats } from '@/lib/hooks/useComunidadAdmin';

/** Usage stats dashboard (Req. 15). Aggregation only, zeros when empty. */
export function StatsTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data, isLoading, isError, refetch } = useGameStats();

  if (isError) {
    return (
      <Card padding="lg" className="flex flex-col items-center gap-3 text-center" role="alert">
        <p className="text-sm text-[var(--color-error)]">{t('error_loading')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-gold-light)]"
        >
          {t('error_retry')}
        </button>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card padding="lg" role="status" aria-live="polite">
        {t('admin_loading')}
      </Card>
    );
  }

  const stat = (icon: React.ReactNode, label: string, value: string | number) => (
    <Card padding="lg" className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      </div>
    </Card>
  );

  const dist = data.streak_distribution;
  const streakChartData = [
    { label: t('stats_streak_none'), value: dist.none },
    { label: '1–2', value: dist.from_1_2 },
    { label: '3–6', value: dist.from_3_6 },
    { label: '7–14', value: dist.from_7_14 },
    { label: '15–29', value: dist.from_15_29 },
    { label: '30+', value: dist.from_30 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stat(<Users className="size-5" />, t('stats_dau'), data.active_users.daily)}
        {stat(<Users className="size-5" />, t('stats_wau'), data.active_users.weekly)}
        {stat(<Users className="size-5" />, t('stats_mau'), data.active_users.monthly)}
        {stat(
          <CalendarCheck className="size-5" />,
          t('stats_daily_participation'),
          `${Math.round(data.daily_question.rate * 100)}%`
        )}
        {stat(<BookOpen className="size-5" />, t('stats_quizzes'), data.quizzes_completed)}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="lg" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Flame className="size-5 text-[var(--color-brand-gold)]" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">{t('stats_streak_distribution')}</h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streakChartData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <RechartsTooltip
                  cursor={{ fill: 'var(--color-brand-gold-muted)' }}
                  contentStyle={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--color-text-primary)' }}
                  formatter={(value) => [value as number, t('stats_streak_users')]}
                />
                <Bar dataKey="value" fill="var(--color-brand-gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-[var(--color-brand-gold)]" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">{t('stats_ranking_preview')}</h3>
          </div>
          {data.ranking_preview.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('stats_empty')}</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {data.ranking_preview.map((r) => (
                <li key={r.user_id} className="flex justify-between">
                  <span>{r.position}. {r.display_name}</span>
                  <span className="font-semibold text-[var(--color-brand-gold)]">{r.points}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-[var(--color-brand-gold)]" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">{t('stats_badges_most')}</h3>
          </div>
          {data.badges_most_unlocked.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('stats_empty')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.badges_most_unlocked.map((b) => (
                <li key={b.badge_id} className="flex justify-between">
                  <span>{b.name}</span>
                  <span className="font-semibold">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-[var(--color-text-muted)]" />
            <h3 className="font-semibold text-[var(--color-text-primary)]">{t('stats_badges_least')}</h3>
          </div>
          {data.badges_least_unlocked.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('stats_empty')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.badges_least_unlocked.map((b) => (
                <li key={b.badge_id} className="flex justify-between">
                  <span>{b.name}</span>
                  <span className="font-semibold">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
