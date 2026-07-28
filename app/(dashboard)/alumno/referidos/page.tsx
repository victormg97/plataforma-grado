'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { MiCodigoCard } from '@/components/referidos/MiCodigoCard';
import { ListaReferidos } from '@/components/referidos/ListaReferidos';
import { RecompensasCard } from '@/components/referidos/RecompensasCard';
import { SistemaDesactivadoBanner } from '@/components/referidos/SistemaDesactivadoBanner';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { ReferralSettings } from '@/lib/referidos/types';

export default function AlumnoReferidosPage() {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  const from = searchParams.get('from');

  useEffect(() => {
    if (user && user.rol !== 'alumno') {
      router.replace(getRolRedirectPath(user.rol));
    }
  }, [user, router]);

  const { data: settings } = useQuery<ReferralSettings>({
    queryKey: ['referral-settings'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/settings');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user,
  });

  const { data: myCode } = useQuery<{ code: string } | null>({
    queryKey: ['my-referral-code'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/codes');
      if (!res.ok) throw new Error();
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    enabled: !!user && user.rol === 'alumno',
  });

  const { data: usages = [] } = useQuery({
    queryKey: ['my-referral-usages'],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/usages');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user && user.rol === 'alumno',
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['referral-reward-rules'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/reward-rules');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!user && user.rol === 'alumno' && !!settings?.show_rewards_to_user,
  });

  const handleVolver = () => {
    if (from) router.push(from);
    else router.back();
  };

  if (!user || user.rol !== 'alumno') return null;

  const systemActive = settings?.platform_enabled && settings?.tenant_enabled;
  const displayName = settings?.display_name || t('titulo');

  return (
    <div>
      <button
        onClick={handleVolver}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="size-4" />
        {tc('volver')}
      </button>

      <PageHeader title={displayName} subtitle={t('subtitulo_alumno')} />

      {!systemActive && (
        <div className="mt-[var(--space-md)]">
          <SistemaDesactivadoBanner
            displayName={displayName}
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
              {/* Decorative accent line */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-brand-gold)] to-transparent opacity-40" />
            </Card>
          )}

          {/* ── Code card ── */}
          {myCode && (
            <MiCodigoCard
              code={myCode.code}
              displayName={displayName}
              disabled={false}
            />
          )}

          {/* ── Referral list ── */}
          {settings?.show_referral_count_to_user && (
            <ListaReferidos usages={usages} showRewards={settings?.show_rewards_to_user ?? false} />
          )}

          {/* ── Rewards ── */}
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
