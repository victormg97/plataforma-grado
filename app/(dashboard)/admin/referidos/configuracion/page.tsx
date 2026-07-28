'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppSelect } from '@/components/common/AppSelect';
import { AppSwitch } from '@/components/common/AppSwitch';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { ModalReglaRecompensa } from '@/components/referidos/ModalReglaRecompensa';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { ReferralSettings, ReferralRewardRule } from '@/lib/referidos/types';
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

  // Debounce ref for text mutations
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State for modals
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReferralRewardRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<ReferralRewardRule | null>(null);

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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t('guardado_ok'));
      queryClient.invalidateQueries({ queryKey: ['referral-settings'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || tc('error'));
    },
  });

  // Debounced text update
  const debouncedUpdate = useCallback(
    (data: Partial<ReferralSettings>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateMutation.mutate(data);
      }, 600);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setTab = (newTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`?${params.toString()}`);
  };

  if (!user || user.rol !== 'admin') return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: t('config_tab_general') },
    { key: 'recompensas', label: t('config_tab_recompensas') },
    ...(settings?.discount_codes_module_enabled
      ? [{ key: 'descuentos' as Tab, label: t('config_tab_descuentos') }]
      : []),
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

        {/* ═══════════════ TAB: GENERAL ═══════════════ */}
        {!isLoading && settings && tab === 'general' && (
          <Card className="p-[var(--space-xl)] space-y-6">
            {/* tenant_enabled */}
            <AppSwitch
              checked={settings.tenant_enabled}
              onChange={(v) => updateMutation.mutate({ tenant_enabled: v })}
              disabled={updateMutation.isPending}
              label={t('activar_sistema')}
              description={t('activar_sistema_desc')}
            />

            {/* display_name */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t('nombre_presentacion')}
              </label>
              <Input
                defaultValue={settings.display_name}
                placeholder={t('nombre_presentacion_placeholder')}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && val !== settings.display_name) {
                    updateMutation.mutate({ display_name: val });
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val && val !== settings.display_name) {
                    debouncedUpdate({ display_name: val });
                  }
                }}
              />
            </div>

            {/* icon selector */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                {t('icono')}
              </label>
              <AppSelect
                value={settings.icon}
                options={REFERRAL_ICON_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(v) => updateMutation.mutate({ icon: v })}
              />
            </div>

            <div className="border-t border-[var(--color-border)] pt-6 space-y-6">
              {/* reader_role_enabled */}
              <AppSwitch
                checked={settings.reader_role_enabled}
                onChange={(v) => updateMutation.mutate({ reader_role_enabled: v })}
                disabled={updateMutation.isPending}
                label={t('habilitar_lectores')}
                description={t('habilitar_lectores_desc')}
              />

              {/* show_rewards_to_user */}
              <AppSwitch
                checked={settings.show_rewards_to_user}
                onChange={(v) => updateMutation.mutate({ show_rewards_to_user: v })}
                disabled={updateMutation.isPending}
                label={t('mostrar_recompensas_usuario')}
                description={t('mostrar_recompensas_usuario_desc')}
              />

              {/* show_referral_count_to_user */}
              <AppSwitch
                checked={settings.show_referral_count_to_user}
                onChange={(v) => updateMutation.mutate({ show_referral_count_to_user: v })}
                disabled={updateMutation.isPending}
                label={t('mostrar_conteo_usuario')}
                description={t('mostrar_conteo_usuario_desc')}
              />

              {/* user_welcome_message */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  {t('mensaje_bienvenida')}
                </label>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  {t('mensaje_bienvenida_desc')}
                </p>
                <textarea
                  defaultValue={settings.user_welcome_message}
                  placeholder={t('mensaje_bienvenida_placeholder')}
                  rows={4}
                  onBlur={(e) => {
                    if (e.target.value !== settings.user_welcome_message) {
                      updateMutation.mutate({ user_welcome_message: e.target.value } as Partial<ReferralSettings>);
                    }
                  }}
                  onChange={(e) => {
                    if (e.target.value !== settings.user_welcome_message) {
                      debouncedUpdate({ user_welcome_message: e.target.value } as Partial<ReferralSettings>);
                    }
                  }}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                />
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] pt-6 space-y-6">
              {/* discount_codes_module_enabled */}
              <AppSwitch
                checked={settings.discount_codes_module_enabled}
                onChange={(v) => updateMutation.mutate({ discount_codes_module_enabled: v })}
                disabled={updateMutation.isPending}
                label={t('modulo_descuentos')}
                description={t('modulo_descuentos_desc')}
              />

              {settings.discount_codes_module_enabled && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                    {t('nombre_modulo_descuentos')}
                  </label>
                  <Input
                    defaultValue={settings.discount_codes_display_name}
                    placeholder="Ej: Códigos de Descuento"
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== settings.discount_codes_display_name) {
                        updateMutation.mutate({ discount_codes_display_name: val });
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== settings.discount_codes_display_name) {
                        debouncedUpdate({ discount_codes_display_name: val });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ═══════════════ TAB: RECOMPENSAS ═══════════════ */}
        {!isLoading && tab === 'recompensas' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingRule(null); setRuleModalOpen(true); }}>
                <Plus className="mr-1.5 size-4" />
                {t('agregar_regla')}
              </Button>
            </div>

            <Card>
              {rules.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="font-medium text-[var(--color-text-primary)]">{t('sin_reglas')}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('sin_reglas_desc')}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {rules.map((rule: ReferralRewardRule) => (
                    <div key={rule.id} className="flex items-center justify-between px-4 py-3 gap-4">
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => { setEditingRule(rule); setRuleModalOpen(true); }}
                      >
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {rule.rule_type === 'referred_new' && t('regla_referido_nuevo')}
                          {rule.rule_type === 'referrer' && t('regla_referente')}
                          {rule.rule_type === 'volume_goal' && t('regla_meta_volumen')}
                          {' — '}
                          {rule.reward_type === 'fixed_amount' && `$${rule.reward_value.toLocaleString('es-CL')}`}
                          {rule.reward_type === 'percentage' && `${rule.reward_value}%`}
                          {rule.reward_type === 'free_session' && t('tipo_sesion_gratis')}
                          {rule.reward_type === 'custom' && rule.volume_reward_description}
                          {(rule.reward_type === 'fixed_amount' || rule.reward_type === 'percentage')
                            ? ` × ${rule.duration_cycles} ciclo(s)` : ''}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {rule.is_active ? t('estado_activo') : t('estado_inactivo')}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeletingRule(rule)}
                        className="shrink-0 rounded-[var(--radius-sm)] p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                        title={t('eliminar_regla')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <ModalReglaRecompensa
              open={ruleModalOpen}
              onClose={() => { setRuleModalOpen(false); setEditingRule(null); }}
              rule={editingRule}
            />

            <ConfirmDeleteModal
              open={deletingRule !== null}
              onClose={() => setDeletingRule(null)}
              onConfirm={async () => {
                if (!deletingRule) return;
                try {
                  const res = await fetch(`/api/referidos/reward-rules/${deletingRule.id}`, { method: 'DELETE' });
                  if (!res.ok) throw new Error();
                  toast.success(t('exito_regla_eliminada'));
                  queryClient.invalidateQueries({ queryKey: ['referral-reward-rules'] });
                } catch {
                  toast.error(t('error_regla'));
                }
                setDeletingRule(null);
              }}
              entityName={deletingRule ? (
                deletingRule.rule_type === 'referred_new' ? t('regla_referido_nuevo') :
                deletingRule.rule_type === 'referrer' ? t('regla_referente') :
                t('regla_meta_volumen')
              ) : ''}
              entityType={t('eliminar_regla').toLowerCase()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
