'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { MiCodigoCard } from '@/components/referidos/MiCodigoCard';
import { ListaReferidos } from '@/components/referidos/ListaReferidos';
import { RecompensasCard } from '@/components/referidos/RecompensasCard';
import { SistemaDesactivadoBanner } from '@/components/referidos/SistemaDesactivadoBanner';
import { Card } from '@/components/common/Card';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { ReferralSettings } from '@/lib/referidos/types';

export default function LectorReferidosPage() {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  const from = searchParams.get('from');

  const { data: settings, isLoading: settingsLoading } = useQuery<ReferralSettings>({
    queryKey: ['referral-settings'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/settings');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user,
  });

  // Redirect if not lector or if reader_role_enabled is false
  useEffect(() => {
    if (!user) return;
    if (user.rol !== 'lector') {
      router.replace(getRolRedirectPath(user.rol));
      return;
    }
    if (settings && !settings.reader_role_enabled) {
      router.replace('/lector');
    }
  }, [user, settings, router]);

  const { data: myCode } = useQuery<{ code: string } | null>({
    queryKey: ['my-referral-code'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/codes');
      if (!res.ok) throw new Error();
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    enabled: !!user && user.rol === 'lector' && !!settings?.reader_role_enabled,
  });

  const { data: usages = [] } = useQuery({
    queryKey: ['my-referral-usages'],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/usages');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user && user.rol === 'lector' && !!settings?.reader_role_enabled,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['referral-reward-rules'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/reward-rules');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user && user.rol === 'lector' && !!settings?.show_rewards_to_user,
  });

  const handleVolver = () => {
    if (from) router.push(from);
    else router.back();
  };

  if (!user || user.rol !== 'lector' || settingsLoading) return null;
  if (settings && !settings.reader_role_enabled) return null;

  const systemActive = settings?.platform_enabled && settings?.tenant_enabled;

  return (
    <div>
      <button
        onClick={handleVolver}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="size-4" />
        {tc('volver')}
      </button>

      <PageHeader
        title={settings?.display_name || t('titulo')}
        subtitle={t('subtitulo')}
      />

      {!systemActive && (
        <div className="mt-[var(--space-md)]">
          <SistemaDesactivadoBanner
            displayName={settings?.display_name || t('titulo')}
            isAdmin={false}
          />
        </div>
      )}

      {systemActive && (
        <div className="mt-[var(--space-lg)] space-y-[var(--space-lg)]">
          {/* ── Welcome context card ── */}
          {settings?.user_welcome_message && (
            <Card className="relative overflow-hidden border-[var(--color-brand-gold)]/20 bg-gradient-to-br from-[var(--color-bg)] to-[color-mix(in_srgb,var(--color-brand-gold)_4%,var(--color-bg))]">
              <div className="flex gap-4 p-[var(--space-lg)]">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
                  <Sparkles className="size-5 text-[var(--color-brand-gold)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                    {t('como_funciona')}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-line">
                    {settings.user_welcome_message}
                  </p>
                </div>
              </div>
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-brand-gold)] to-transparent opacity-40" />
            </Card>
          )}

          {myCode && (
            <MiCodigoCard
              code={myCode.code}
              displayName={settings?.display_name || t('titulo')}
              disabled={false}
            />
          )}

          {settings?.show_referral_count_to_user && (
            <ListaReferidos usages={usages} showRewards={settings?.show_rewards_to_user ?? false} />
          )}

          {settings?.show_rewards_to_user && user && (
            <RecompensasCard
              rules={rules}
              usages={usages}
              userId={user.id}
              showRewards={settings.show_rewards_to_user}
              showCount={settings.show_referral_count_to_user}
            />
          )}
        </div>
      )}
    </div>
  );
}
