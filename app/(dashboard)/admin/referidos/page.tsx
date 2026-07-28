'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Settings, ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { SistemaDesactivadoBanner } from '@/components/referidos/SistemaDesactivadoBanner';
import { ModalCodigoDescuento } from '@/components/referidos/ModalCodigoDescuento';
import { useUser } from '@/lib/hooks/useUser';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { ReferralSettings, DiscountCode } from '@/lib/referidos/types';

type Tab = 'codigos' | 'usos' | 'estadisticas' | 'descuentos';

export default function AdminReferidosPage() {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const tab = (searchParams.get('tab') as Tab) ?? 'codigos';
  const from = searchParams.get('from');

  // Discount code modal state
  const [dcModalOpen, setDcModalOpen] = useState(false);
  const [editingDc, setEditingDc] = useState<DiscountCode | null>(null);
  const [deletingDc, setDeletingDc] = useState<DiscountCode | null>(null);

  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace(getRolRedirectPath(user.rol));
    }
  }, [user, router]);

  const { data: settings, isLoading: settingsLoading } = useQuery<ReferralSettings>({
    queryKey: ['referral-settings'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/settings');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: user?.rol === 'admin',
  });

  const { data: codes = [], isLoading: codesLoading } = useQuery({
    queryKey: ['referral-codes'],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/codes');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: user?.rol === 'admin',
  });

  const { data: usages = [], isLoading: usagesLoading } = useQuery({
    queryKey: ['referral-usages'],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/usages');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: user?.rol === 'admin',
  });

  const { data: discountCodes = [], isLoading: discountLoading } = useQuery({
    queryKey: ['discount-codes'],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/discount-codes');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: user?.rol === 'admin' && tab === 'descuentos' && settings?.discount_codes_module_enabled,
  });

  const setTab = (newTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.replace(`?${params.toString()}`);
  };

  const handleVolver = () => {
    if (from) router.push(from);
    else router.back();
  };

  if (!user || user.rol !== 'admin') return null;
  if (settingsLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  if (!settings?.platform_enabled) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--color-text-muted)] text-sm">{t('sistema_desactivado', { nombre: 'Referidos' })}</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'codigos', label: t('tab_codigos') },
    { key: 'usos', label: t('tab_usos') },
    { key: 'estadisticas', label: t('tab_estadisticas') },
    ...(settings.discount_codes_module_enabled
      ? [{ key: 'descuentos' as Tab, label: t('tab_descuentos') }]
      : []),
  ];

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
        title={settings.display_name || t('titulo')}
        subtitle={t('subtitulo')}
        actions={
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/referidos/configuracion')}
          >
            <Settings className="mr-1.5 size-4" />
            {t('config_titulo')}
          </Button>
        }
      />

      {!settings.tenant_enabled && (
        <div className="mt-[var(--space-md)]">
          <SistemaDesactivadoBanner
            displayName={settings.display_name}
            isAdmin
            configHref="/admin/referidos/configuracion"
          />
        </div>
      )}

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
        {tab === 'codigos' && (
          codesLoading ? (
            <div className="flex justify-center py-12">
              <div className="size-7 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
            </div>
          ) : (
            <Card>
              {codes.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{t('sin_codigos')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_usuario')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_rol')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_codigo')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_referidos')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_fecha')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map((c: { id: string; code: string; created_at: string; referral_count: number; owner: { nombre: string; apellido: string; email: string; rol: string } }) => (
                        <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--color-text-primary)]">{c.owner.nombre} {c.owner.apellido}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{c.owner.email}</div>
                          </td>
                          <td className="px-4 py-3 capitalize text-[var(--color-text-secondary)]">{c.owner.rol}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold tracking-wider text-[var(--color-brand-gold)]">{c.code}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-primary)]">{c.referral_count}</td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">
                            {new Date(c.created_at).toLocaleDateString('es-CL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        )}

        {tab === 'usos' && (
          usagesLoading ? (
            <div className="flex justify-center py-12">
              <div className="size-7 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
            </div>
          ) : (
            <Card>
              {usages.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{t('sin_usos')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_usuario')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_codigo')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_fecha')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usages.map((u: { id: string; used_at: string; referred_user?: { nombre: string; apellido: string; email: string }; referrer_code?: string; discount_code?: string }) => (
                        <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--color-text-primary)]">{u.referred_user?.nombre} {u.referred_user?.apellido}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{u.referred_user?.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-[var(--color-brand-gold)]">{u.referrer_code ?? u.discount_code}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">
                            {new Date(u.used_at).toLocaleDateString('es-CL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        )}

        {tab === 'estadisticas' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-[var(--space-lg)]">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{t('total_referidos')}</p>
              <p className="mt-2 text-3xl font-bold text-[var(--color-brand-gold)]">{usages.length}</p>
            </Card>
            <Card className="p-[var(--space-lg)]">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{t('codigos_activos')}</p>
              <p className="mt-2 text-3xl font-bold text-[var(--color-brand-gold)]">{codes.length}</p>
            </Card>
            <Card className="p-[var(--space-lg)]">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{t('top_referentes')}</p>
              {codes.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {[...codes]
                    .sort((a: { referral_count: number }, b: { referral_count: number }) => b.referral_count - a.referral_count)
                    .slice(0, 3)
                    .map((c: { id: string; code: string; referral_count: number; owner: { nombre: string; apellido: string } }) => (
                      <div key={c.id} className="flex justify-between text-sm">
                        <span className="text-[var(--color-text-primary)]">{c.owner.nombre} {c.owner.apellido}</span>
                        <span className="font-bold text-[var(--color-brand-gold)]">{c.referral_count}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">—</p>
              )}
            </Card>
          </div>
        )}

        {tab === 'descuentos' && settings.discount_codes_module_enabled && (
          discountLoading ? (
            <div className="flex justify-center py-12">
              <div className="size-7 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditingDc(null); setDcModalOpen(true); }}>
                  <Plus className="mr-1.5 size-4" />
                  {t('crear_codigo_descuento')}
                </Button>
              </div>

              <Card>
                {discountCodes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{t('sin_codigos_descuento')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)]">
                          <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('columna_codigo')}</th>
                          <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('fecha_inicio')}</th>
                          <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('fecha_termino')}</th>
                          <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('usos')}</th>
                          <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">{t('estado_activo')}</th>
                          <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]" />
                        </tr>
                      </thead>
                      <tbody>
                        {discountCodes.map((dc: DiscountCode & { usage_count?: number }) => {
                          const active = dc.manual_override !== null
                            ? dc.manual_override
                            : dc.is_active && (!dc.start_date || new Date(dc.start_date) <= new Date()) && (!dc.end_date || new Date(dc.end_date) >= new Date());
                          return (
                            <tr key={dc.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                              <td className="px-4 py-3">
                                <span className="font-mono font-bold tracking-wider text-[var(--color-brand-gold)]">{dc.code}</span>
                              </td>
                              <td className="px-4 py-3 text-[var(--color-text-muted)]">{dc.start_date ? new Date(dc.start_date).toLocaleDateString('es-CL') : '—'}</td>
                              <td className="px-4 py-3 text-[var(--color-text-muted)]">{dc.end_date ? new Date(dc.end_date).toLocaleDateString('es-CL') : '—'}</td>
                              <td className="px-4 py-3 text-[var(--color-text-primary)]">{dc.usage_count ?? 0}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'}`}>
                                  {active ? t('estado_activo') : t('estado_inactivo')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => { setEditingDc(dc); setDcModalOpen(true); }}
                                    className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingDc(dc)}
                                    className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <ModalCodigoDescuento
                open={dcModalOpen}
                onClose={() => { setDcModalOpen(false); setEditingDc(null); }}
                code={editingDc}
              />

              <ConfirmDeleteModal
                open={deletingDc !== null}
                onClose={() => setDeletingDc(null)}
                onConfirm={async () => {
                  if (!deletingDc) return;
                  try {
                    const res = await fetch(`/api/referidos/discount-codes/${deletingDc.id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error();
                    toast.success(t('exito_codigo_eliminado'));
                    queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
                  } catch {
                    toast.error(t('error_codigo'));
                  }
                  setDeletingDc(null);
                }}
                entityName={deletingDc?.code ?? ''}
                entityType={t('eliminar_regla').toLowerCase()}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
