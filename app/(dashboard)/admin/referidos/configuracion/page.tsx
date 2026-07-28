'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppSelect } from '@/components/common/AppSelect';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { ReferralSettings } from '@/lib/referidos/types';
import { REFERRAL_ICON_OPTIONS } from '@/lib/referidos/types';

type Tab = 'general' | 'recompensas' | 'descuentos';

export default function ConfiguracionReferidosPage() {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const tab = (searchParams.get('tab') as Tab) ?? 'general';

  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace(getRolRedirectPath(user.rol));
    }
  }, [user, router]);

  const { data: settings, isLoading } = useQuery<ReferralSettings>({
    queryKey: ['referral-settings'],
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch('/api/referidos/settings');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: user?.rol === 'admin',
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['referral-reward-rules'],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/reward-rules');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: user?.rol === 'admin' && tab === 'recompensas',
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ReferralSettings>) => {
      const res = await fetch('/api/referidos/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('guardado_ok'));
      queryClient.invalidateQueries({ queryKey: ['referral-settings'] });
    },
    onError: () => toast.error(tc('error')),
  });

  const setTab = (newTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`?${params.toString()}`);
  };

  if (!user || user.rol !== 'admin') return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: t('config_tab_general') },
    { key: 'recompensas', label: t('config_tab_recompensas') },
    ...(settings?.discount_codes_module_enabled ? [{ key: 'descuentos' as Tab, label: t('config_tab_descuentos') }] : []),
  ];

  return (
    <div>
      <button
        onClick={() => router.push('/admin/referidos')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="size-4" />
        {tc('volver')}
      </button>

      <PageHeader title={t('config_titulo')} subtitle={t('config_subtitulo')} />

      {/* Tabs */}
      <div className="mt-[var(--space-lg)] flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map((t2) => (
          <button
            key={t2.key}
            onClick={() => setTab(t2.key)}
            className={`min-h-[44px] px-4 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t2.key
                ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {t2.label}
          </button>
        ))}
      </div>

      <div className="mt-[var(--space-lg)]">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="size-7 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        )}

        {!isLoading && settings && tab === 'general' && (
          <Card className="p-[var(--space-xl)] max-w-xl space-y-6">
            {/* tenant_enabled toggle */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{t('activar_sistema')}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{t('activar_sistema_desc')}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.tenant_enabled}
                onClick={() => updateMutation.mutate({ tenant_enabled: !settings.tenant_enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.tenant_enabled ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-strong)]'}`}
              >
                <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${settings.tenant_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* display_name */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t('nombre_presentacion')}</label>
              <input
                defaultValue={settings.display_name}
                placeholder={t('nombre_presentacion_placeholder')}
                onBlur={(e) => {
                  if (e.target.value !== settings.display_name) {
                    updateMutation.mutate({ display_name: e.target.value });
                  }
                }}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
              />
            </div>

            {/* icon selector */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">{t('icono')}</label>
              <AppSelect
                value={settings.icon}
                options={REFERRAL_ICON_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(v) => updateMutation.mutate({ icon: v })}
              />
            </div>

            {/* reader_role_enabled */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{t('habilitar_lectores')}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{t('habilitar_lectores_desc')}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.reader_role_enabled}
                onClick={() => updateMutation.mutate({ reader_role_enabled: !settings.reader_role_enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.reader_role_enabled ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-strong)]'}`}
              >
                <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${settings.reader_role_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* show_rewards_to_user */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{t('mostrar_recompensas_usuario')}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{t('mostrar_recompensas_usuario_desc')}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.show_rewards_to_user}
                onClick={() => updateMutation.mutate({ show_rewards_to_user: !settings.show_rewards_to_user })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.show_rewards_to_user ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-strong)]'}`}
              >
                <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${settings.show_rewards_to_user ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* show_referral_count_to_user */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{t('mostrar_conteo_usuario')}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{t('mostrar_conteo_usuario_desc')}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.show_referral_count_to_user}
                onClick={() => updateMutation.mutate({ show_referral_count_to_user: !settings.show_referral_count_to_user })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.show_referral_count_to_user ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-strong)]'}`}
              >
                <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${settings.show_referral_count_to_user ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* discount_codes_module_enabled */}
            <div className="flex items-start justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{t('modulo_descuentos')}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{t('modulo_descuentos_desc')}</p>
              </div>
              <button
                role="switch"
                aria-checked={settings.discount_codes_module_enabled}
                onClick={() => updateMutation.mutate({ discount_codes_module_enabled: !settings.discount_codes_module_enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.discount_codes_module_enabled ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-strong)]'}`}
              >
                <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${settings.discount_codes_module_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </Card>
        )}

        {!isLoading && tab === 'recompensas' && (
          <Card>
            {rules.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-medium text-[var(--color-text-primary)]">{t('sin_reglas')}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('sin_reglas_desc')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {rules.map((rule: { id: string; rule_type: string; reward_type: string; reward_value: number; duration_cycles: number; is_active: boolean; volume_reward_description?: string }) => (
                  <div key={rule.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {rule.rule_type === 'referred_new' && t('regla_referido_nuevo')}
                        {rule.rule_type === 'referrer' && t('regla_referente')}
                        {rule.rule_type === 'volume_goal' && t('regla_meta_volumen')}
                        {' — '}
                        {rule.reward_type === 'fixed_amount' && `$${rule.reward_value.toLocaleString('es-CL')}`}
                        {rule.reward_type === 'percentage' && `${rule.reward_value}%`}
                        {rule.reward_type === 'free_session' && t('tipo_sesion_gratis')}
                        {rule.reward_type === 'custom' && rule.volume_reward_description}
                        {rule.reward_type === 'fixed_amount' || rule.reward_type === 'percentage'
                          ? ` × ${rule.duration_cycles} ciclo(s)` : ''}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {rule.is_active ? t('estado_activo') : t('estado_inactivo')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
