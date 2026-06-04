'use client';

import { Suspense, useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, Link2, UserX, UserCheck, Pencil, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { Avatar } from '@/components/common/Avatar';
import { Tooltip } from '@/components/common/Tooltip';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import type { LectorAdmin } from '@/app/api/admin/lectores/route';

// ─── Inner component (needs Suspense for useQueryParam) ──────────────────────

function AdminLectoresContent() {
  const router = useRouter();
  const tl = useTranslations('lectores');
  const tc = useTranslations('common');
  const te = useTranslations('enlaces');
  const queryClient = useQueryClient();

  const [q, setQ] = useQueryParam('q');
  const [searchText, setSearchText] = useState(q || '');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSearchText(q || ''); }, []);

  const { data: lectores = [], isLoading } = useQuery<LectorAdmin[]>({
    queryKey: ['admin-lectores'],
    queryFn: async () => {
      const res = await fetch('/api/admin/lectores');
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!searchText) return lectores;
    const lower = searchText.toLowerCase();
    return lectores.filter(
      (l) =>
        l.nombre.toLowerCase().includes(lower) ||
        l.apellido.toLowerCase().includes(lower) ||
        `${l.nombre} ${l.apellido}`.toLowerCase().includes(lower) ||
        l.email.toLowerCase().includes(lower),
    );
  }, [lectores, searchText]);

  const activos = useMemo(() => filtered.filter((l) => l.activo), [filtered]);
  const bloqueados = useMemo(() => filtered.filter((l) => !l.activo), [filtered]);

  // ── Block/Unblock ──────────────────────────────────────────────────────────
  const [confirmBlock, setConfirmBlock] = useState<LectorAdmin | null>(null);
  const [blocking, setBlocking] = useState(false);

  const handleToggleBlock = async () => {
    if (!confirmBlock || blocking) return;
    try {
      setBlocking(true);
      const res = await fetch(`/api/admin/alumnos/${confirmBlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !confirmBlock.activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(confirmBlock.activo ? tl('exito_bloqueado') : tl('exito_desbloqueado'));
      setConfirmBlock(null);
      queryClient.invalidateQueries({ queryKey: ['admin-lectores'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lectores-exists'] });
    } catch {
      toast.error(tl('error_bloquear'));
    } finally {
      setBlocking(false);
    }
  };

  // ── Promote to alumno ──────────────────────────────────────────────────────
  const [confirmPromote, setConfirmPromote] = useState<LectorAdmin | null>(null);
  const [promoting, setPromoting] = useState(false);

  const handlePromote = async () => {
    if (!confirmPromote || promoting) return;
    try {
      setPromoting(true);
      const res = await fetch(`/api/admin/alumnos/${confirmPromote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: 'alumno' }),
      });
      if (!res.ok) throw new Error();
      toast.success(tl('exito_promovido', { nombre: `${confirmPromote.nombre} ${confirmPromote.apellido}` }));
      setConfirmPromote(null);
      queryClient.invalidateQueries({ queryKey: ['admin-lectores'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lectores-exists'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error(tl('error_promover'));
    } finally {
      setPromoting(false);
    }
  };

  // ── Render group ───────────────────────────────────────────────────────────
  const renderGroup = (items: LectorAdmin[], labelKey: string) => {
    const label = tl(labelKey as Parameters<typeof tl>[0]);
    if (items.length === 0 && labelKey !== 'grupo_activos') return null;
    return (
      <div key={labelKey}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {label} ({items.length})
        </h2>

        {items.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">{tl('sin_lectores')}</p>
          </Card>
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-2 md:hidden">
              {items.map((l) => (
                <div
                  key={l.id}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-md)]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar nombre={l.nombre} apellido={l.apellido} avatarUrl={l.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--color-text-primary)]">
                        {l.nombre} {[l.apellido, l.apellido_materno].filter(Boolean).join(' ')}
                      </p>
                      <p className="truncate text-xs text-[var(--color-text-muted)]">{l.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1 border-t border-[var(--color-border)] pt-2">
                    <LectorRowActions
                      lector={l}
                      onEdit={() => router.push(`/admin/alumnos/${l.id}/editar`)}
                      onToggleBlock={() => setConfirmBlock(l)}
                      onPromote={() => setConfirmPromote(l)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-left text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                      <th className="px-4 py-3">{tl('col_nombre')}</th>
                      <th className="px-4 py-3">{tl('col_email')}</th>
                      <th className="px-4 py-3 hidden lg:table-cell">{tl('col_telefono')}</th>
                      <th className="px-4 py-3 text-right">{tc('acciones')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-bg-secondary)]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar nombre={l.nombre} apellido={l.apellido} avatarUrl={l.avatar_url} size="sm" />
                            <p className="font-medium text-[var(--color-text-primary)]">
                              {l.nombre} {[l.apellido, l.apellido_materno].filter(Boolean).join(' ')}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{l.email}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)]">
                          {l.telefono || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LectorRowActions
                            lector={l}
                            onEdit={() => router.push(`/admin/alumnos/${l.id}/editar`)}
                            onToggleBlock={() => setConfirmBlock(l)}
                            onPromote={() => setConfirmPromote(l)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const nombreCompleto = confirmBlock
    ? `${confirmBlock.nombre} ${confirmBlock.apellido}`
    : confirmPromote
    ? `${confirmPromote.nombre} ${confirmPromote.apellido}`
    : '';

  return (
    <div>
      <PageHeader
        title={tl('titulo')}
        subtitle={tl('subtitulo')}
        actions={
          <Button variant="secondary" onClick={() => router.push('/enlaces-invitacion?from=/admin/lectores')}>
            <Link2 className="mr-1.5 size-4" />
            {te('boton_enlace_invitacion')}
          </Button>
        }
      />

      {/* Search */}
      <div className="mt-[var(--space-lg)]">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
          <input
            value={searchText}
            onChange={(e) => {
              const val = e.target.value;
              setSearchText(val);
              if (searchDebounce.current) clearTimeout(searchDebounce.current);
              searchDebounce.current = setTimeout(() => setQ(val || null), 400);
            }}
            placeholder={tl('buscar_placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Groups */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-lg)]">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : (
          <>
            {renderGroup(activos, 'grupo_activos')}
            {renderGroup(bloqueados, 'grupo_bloqueados')}
          </>
        )}
      </div>

      {/* Block/Unblock confirm */}
      <ConfirmModal
        open={!!confirmBlock}
        onClose={() => setConfirmBlock(null)}
        onConfirm={handleToggleBlock}
        title={confirmBlock?.activo ? tl('bloquear_titulo') : tl('desbloquear_titulo')}
        description={
          confirmBlock?.activo
            ? tl('bloquear_descripcion', { nombre: nombreCompleto })
            : tl('desbloquear_descripcion', { nombre: nombreCompleto })
        }
        confirmText={confirmBlock?.activo ? tl('bloquear_confirmar') : tl('desbloquear_confirmar')}
        cancelText={tc('cancelar')}
        loading={blocking}
        isDanger={confirmBlock?.activo ?? false}
      />

      {/* Promote to alumno */}
      <ConfirmModal
        open={!!confirmPromote}
        onClose={() => setConfirmPromote(null)}
        onConfirm={handlePromote}
        title={tl('promover_titulo')}
        description={tl('promover_descripcion', { nombre: nombreCompleto })}
        confirmText={tl('promover_confirmar')}
        cancelText={tc('cancelar')}
        loading={promoting}
        isDanger={false}
      />
    </div>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────

function LectorRowActions({
  lector,
  onEdit,
  onToggleBlock,
  onPromote,
}: {
  lector: LectorAdmin;
  onEdit: () => void;
  onToggleBlock: () => void;
  onPromote: () => void;
}) {
  const tc = useTranslations('common');
  const tl = useTranslations('lectores');
  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip content={tc('editar')}>
        <button
          onClick={onEdit}
          className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
        >
          <Pencil className="size-4" />
        </button>
      </Tooltip>
      <Tooltip content={tl('promover_tooltip')}>
        <button
          onClick={onPromote}
          className="cursor-pointer rounded p-1.5 text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]"
        >
          <GraduationCap className="size-4" />
        </button>
      </Tooltip>
      <Tooltip content={lector.activo ? tl('bloquear_titulo') : tl('desbloquear_titulo')}>
        <button
          onClick={onToggleBlock}
          className={`cursor-pointer rounded p-1.5 ${lector.activo ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/5' : 'text-[var(--color-success)] hover:bg-[var(--color-success)]/5'}`}
        >
          {lector.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
        </button>
      </Tooltip>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function AdminLectoresPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      }
    >
      <AdminLectoresContent />
    </Suspense>
  );
}
