'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Settings, ArrowLeft, Plus, Trash2, Pencil, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { AppSelect } from '@/components/common/AppSelect';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { SistemaDesactivadoBanner } from '@/components/referidos/SistemaDesactivadoBanner';
import { ModalCodigoDescuento } from '@/components/referidos/ModalCodigoDescuento';
import { useUser } from '@/lib/hooks/useUser';
import { useUiPreference } from '@/lib/hooks/useUiPreference';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { ReferralSettings, DiscountCode, ReferralRewardRule } from '@/lib/referidos/types';

type Tab = 'codigos' | 'usos' | 'estadisticas' | 'descuentos';

type SortKey = 'nombre' | 'rol' | 'codigo' | 'referidos';
type SortDir = 'asc' | 'desc';
type SortState = { key: SortKey; dir: SortDir };

interface CodeRow {
  id: string;
  code: string;
  created_at: string;
  referral_count: number;
  owner: {
    nombre: string;
    apellido: string;
    apellido_materno?: string | null;
    email: string;
    rol: string;
  };
}

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
];

function getFullName(o: CodeRow['owner']): string {
  const parts = [o.nombre, o.apellido];
  if (o.apellido_materno) parts.push(o.apellido_materno);
  return parts.join(' ');
}

export default function AdminReferidosPage() {
  const t = useTranslations('referidos');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const tab = (searchParams.get('tab') as Tab) ?? 'codigos';
  const from = searchParams.get('from');

  // Persisted sort order
  const [sortState, setSortState] = useUiPreference<SortState>('referidos_codes_sort', { key: 'referidos', dir: 'desc' });
  const [pageSize, setPageSize] = useUiPreference<number>('referidos_codes_page_size', 10);
  const [currentPage, setCurrentPage] = useState(0);

  // Discount code modal state
  const [dcModalOpen, setDcModalOpen] = useState(false);
  const [editingDc, setEditingDc] = useState<DiscountCode | null>(null);
  const [deletingDc, setDeletingDc] = useState<DiscountCode | null>(null);

  // User detail modal
  const [detailCode, setDetailCode] = useState<CodeRow | null>(null);

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

  const { data: codes = [], isLoading: codesLoading } = useQuery<CodeRow[]>({
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

  const { data: rules = [] } = useQuery<ReferralRewardRule[]>({
    queryKey: ['referral-reward-rules'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/referidos/reward-rules');
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: user?.rol === 'admin',
  });

  // ── Sorting & Pagination (client-side, no extra DB calls) ──
  const sortedCodes = useMemo(() => {
    const sorted = [...codes];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortState.key) {
        case 'nombre':
          cmp = getFullName(a.owner).localeCompare(getFullName(b.owner));
          break;
        case 'rol':
          cmp = a.owner.rol.localeCompare(b.owner.rol);
          break;
        case 'codigo':
          cmp = a.code.localeCompare(b.code);
          break;
        case 'referidos':
          cmp = a.referral_count - b.referral_count;
          break;
      }
      return sortState.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [codes, sortState]);

  const totalPages = Math.ceil(sortedCodes.length / pageSize);
  const pagedCodes = sortedCodes.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // Reset page when sort changes or data updates
  useEffect(() => { setCurrentPage(0); }, [sortState, codes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = (key: SortKey) => {
    setSortState(
      sortState.key === key
        ? { key, dir: sortState.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' }
    );
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortState.key !== col) return <ChevronDown className="size-3 opacity-30" />;
    return sortState.dir === 'asc'
      ? <ChevronUp className="size-3 text-[var(--color-brand-gold)]" />
      : <ChevronDown className="size-3 text-[var(--color-brand-gold)]" />;
  };

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

  // Top referentes for stats: only show users with > 0
  const topReferentes = [...codes]
    .filter((c) => c.referral_count > 0)
    .sort((a, b) => b.referral_count - a.referral_count)
    .slice(0, 5);

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

        {/* ═══ TAB: CÓDIGOS ═══ */}
        {tab === 'codigos' && (
          codesLoading ? (
            <div className="flex justify-center py-12">
              <div className="size-7 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
            </div>
          ) : codes.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">{t('sin_codigos')}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => toggleSort('nombre')} className="inline-flex items-center gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                            {t('columna_usuario')} <SortIcon col="nombre" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => toggleSort('rol')} className="inline-flex items-center gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                            {t('columna_rol')} <SortIcon col="rol" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => toggleSort('codigo')} className="inline-flex items-center gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                            {t('columna_codigo')} <SortIcon col="codigo" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => toggleSort('referidos')} className="inline-flex items-center gap-1 font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                            {t('columna_referidos')} <SortIcon col="referidos" />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCodes.map((c) => (
                        <tr
                          key={c.id}
                          className={`border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] ${c.referral_count > 0 ? 'cursor-pointer' : ''}`}
                          onClick={() => { if (c.referral_count > 0) setDetailCode(c); }}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-[var(--color-text-primary)]">{getFullName(c.owner)}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{c.owner.email}</div>
                          </td>
                          <td className="px-4 py-3 capitalize text-[var(--color-text-secondary)]">{c.owner.rol}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold tracking-wider text-[var(--color-brand-gold)]">{c.code}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-primary)]">
                            {c.referral_count > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand-gold)]">
                                {c.referral_count}
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Pagination */}
              {sortedCodes.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">{t('filas_por_pagina')}</span>
                    <AppSelect
                      value={String(pageSize)}
                      options={PAGE_SIZE_OPTIONS}
                      onChange={(v) => { setPageSize(Number(v)); setCurrentPage(0); }}
                      className="w-[70px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sortedCodes.length)} {t('de')} {sortedCodes.length}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                      className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ═══ TAB: USOS ═══ */}
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

        {/* ═══ TAB: ESTADÍSTICAS ═══ */}
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
              {topReferentes.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {topReferentes.map((c) => (
                    <div key={c.id} className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-primary)]">{getFullName(c.owner)}</span>
                      <span className="font-bold text-[var(--color-brand-gold)]">{c.referral_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex flex-col items-center gap-2 py-2">
                  <Users className="size-5 text-[var(--color-text-muted)]" />
                  <p className="text-xs text-[var(--color-text-muted)] text-center">{t('sin_referidos_aun')}</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ═══ TAB: DESCUENTOS ═══ */}
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
                              <td className="px-4 py-3"><span className="font-mono font-bold tracking-wider text-[var(--color-brand-gold)]">{dc.code}</span></td>
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
                                  <button onClick={() => { setEditingDc(dc); setDcModalOpen(true); }} className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"><Pencil className="size-3.5" /></button>
                                  <button onClick={() => setDeletingDc(dc)} className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"><Trash2 className="size-3.5" /></button>
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

              <ModalCodigoDescuento open={dcModalOpen} onClose={() => { setDcModalOpen(false); setEditingDc(null); }} code={editingDc} />
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
                  } catch { toast.error(t('error_codigo')); }
                  setDeletingDc(null);
                }}
                entityName={deletingDc?.code ?? ''}
                entityType={t('eliminar_regla').toLowerCase()}
              />
            </div>
          )
        )}
      </div>

      {/* ═══ DETAIL MODAL ═══ */}
      {detailCode && (
        <DetailModal
          code={detailCode}
          usages={usages}
          rules={rules}
          t={t}
          onClose={() => setDetailCode(null)}
        />
      )}
    </div>
  );
}

// ─── Detail Modal (user referral breakdown) ──────────────────────────────────

import { Modal } from '@/components/common/Modal';
import { Gift, Target } from 'lucide-react';

function DetailModal({
  code,
  usages,
  rules,
  t,
  onClose,
}: {
  code: CodeRow;
  usages: { id: string; used_at: string; user_referral_code_id?: string; referred_user?: { nombre: string; apellido: string; email: string } }[];
  rules: ReferralRewardRule[];
  t: ReturnType<typeof useTranslations>;
  onClose: () => void;
}) {
  // Filter usages that belong to this user's code
  const userUsages = usages.filter((u) => {
    // Match by code — the usages have referrer_code field from enrichment
    return (u as Record<string, unknown>).referrer_code === code.code;
  });

  const volumeRule = rules.find((r) => r.rule_type === 'volume_goal' && r.is_active);
  const now = new Date();
  const thisMonthUsages = userUsages.filter((u) => {
    const d = new Date(u.used_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <Modal open onClose={onClose} title={`${getFullName(code.owner)} — ${code.code}`}>
      <div className="space-y-5">
        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-4 text-center">
            <p className="text-xs text-[var(--color-text-muted)] uppercase">{t('total_referidos')}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-brand-gold)]">{code.referral_count}</p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-4 text-center">
            <p className="text-xs text-[var(--color-text-muted)] uppercase">{t('referidos_este_mes')}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{thisMonthUsages.length}</p>
          </div>
        </div>

        {/* Volume goal progress */}
        {volumeRule && volumeRule.volume_target && (
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
            <Target className="size-5 text-[var(--color-brand-gold)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('progreso_meta')}: {thisMonthUsages.length} / {volumeRule.volume_target}
              </p>
              <div className="mt-1.5 h-2 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-gold)] transition-all"
                  style={{ width: `${Math.min(100, (thisMonthUsages.length / volumeRule.volume_target) * 100)}%` }}
                />
              </div>
              {volumeRule.volume_reward_description && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  <Gift className="inline size-3 mr-1" />
                  {volumeRule.volume_reward_description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Referral list */}
        {userUsages.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('mis_referidos')}</p>
            <div className="max-h-[200px] overflow-y-auto divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
              {userUsages.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm text-[var(--color-text-primary)]">{u.referred_user?.nombre} {u.referred_user?.apellido}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{u.referred_user?.email}</p>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {new Date(u.used_at).toLocaleDateString('es-CL')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
