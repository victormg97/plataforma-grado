'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, Eye, Pencil, CalendarDays, BookOpen, CalendarRange, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import { CardActions, type CardAction } from '@/components/common/CardActions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/components/common/Tooltip';

type Profesor = {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  rol: string;
  alumnos_count: number;
  estado_cuenta?: 'Pendiente' | 'Activo';
};

export default function ProfesoresPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tp = useTranslations('profesores');
  const tc = useTranslations('common');
  const te = useTranslations('enlaces');
  const { data: profesores = [], isLoading: loading } = useQuery<Profesor[]>({
    queryKey: ['admin-profesores'],
    queryFn: async () => {
      const res = await fetch('/api/admin/profesores');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const [confirmAction, setConfirmAction] = useState<{ id: string; nombre: string; activo: boolean } | null>(null);

  const handleToggle = async () => {
    if (!confirmAction) return;
    try {
      const res = await fetch(`/api/admin/profesores/${confirmAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !confirmAction.activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(confirmAction.activo ? tp('exito_deshabilitado') : tp('exito_habilitado'));
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
    } catch {
      toast.error(tp('error_actualizar'));
    }
  };

  const sortedProfesores = useMemo(
    () => [...profesores].sort((a, b) => {
      if (a.rol === 'admin' && b.rol !== 'admin') return -1;
      if (a.rol !== 'admin' && b.rol === 'admin') return 1;
      return 0;
    }),
    [profesores]
  );

  const nombreCompleto = (p: Profesor) =>
    [p.nombre, p.apellido, p.apellido_materno].filter(Boolean).join(' ');


  return (
    <div>
      <PageHeader
        title={tp('titulo')}
        subtitle={tp('subtitulo')}
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push('/enlaces-invitacion?from=/admin/profesores')}>
              <Link2 className="mr-1.5 size-4" />
              {te('boton_enlace_invitacion')}
            </Button>
            <Button onClick={() => router.push('/admin/profesores/crear')}>
              <Plus className="mr-1.5 size-4" />
              {tp('nuevo_profesor')}
            </Button>
          </>
        }
      />

      <div className="mt-[var(--space-lg)] space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : profesores.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">{tp('sin_profesores')}</p>
          </Card>
        ) : (
          sortedProfesores.map((p) => (
            <Card key={p.id} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar nombre={p.nombre} apellido={p.apellido} avatarUrl={p.avatar_url} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[var(--color-text-primary)]">{nombreCompleto(p)}</p>
                    {p.rol === 'admin' ? (
                      <span className="rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">Admin</span>
                    ) : (
                      <StatusBadge status={p.estado_cuenta === 'Pendiente' ? 'pendiente' : (p.activo ? 'activo' : 'inactivo')} />
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">{p.email}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{tp('alumnos_asignados', { count: p.alumnos_count })}</p>
                </div>
              </div>

              {/* ── Desktop: full button row (unchanged design) ── */}
              <div className="hidden lg:flex items-center gap-2 ml-auto lg:ml-0">
                <Tooltip content={tc('editar')}>
                  <button
                    onClick={() => router.push(`/admin/profesores/${p.id}/editar`)}
                    className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                  >
                    <Pencil className="size-4" />
                  </button>
                </Tooltip>
                {p.rol !== 'admin' && (
                  <Tooltip content={p.activo ? tp('deshabilitar') : tp('habilitar')}>
                    <button
                      onClick={() => setConfirmAction({ id: p.id, nombre: nombreCompleto(p), activo: p.activo })}
                      className={`flex items-center gap-1 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition-colors ${
                        p.activo
                          ? 'border-[var(--color-error)] text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20'
                          : 'border-[var(--color-success)] text-[var(--color-success)] hover:bg-green-50 dark:hover:bg-green-950/20'
                      }`}
                    >
                      {p.activo ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                      {p.activo ? tp('deshabilitar') : tp('habilitar')}
                    </button>
                  </Tooltip>
                )}
                <Tooltip content={tp('ver_alumnos')}>
                  <Link
                    href={`/admin/alumnos?profesor_id=${p.id}`}
                    className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                  >
                    <Eye className="size-3.5" />
                    {tp('ver_alumnos')}
                  </Link>
                </Tooltip>
                <Tooltip content={tp('ver_clases')}>
                  <Link
                    href={`/admin/profesores/${p.id}/horarios`}
                    className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                  >
                    <CalendarDays className="size-3.5" />
                    {tp('ver_clases')}
                  </Link>
                </Tooltip>
                <Tooltip content={tp('ver_agenda')}>
                  <Link
                    href={`/admin/profesores/${p.id}/horarios?tab=agenda`}
                    className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                  >
                    <CalendarRange className="size-3.5" />
                    {tp('ver_agenda')}
                  </Link>
                </Tooltip>
              </div>

              {/* ── Mobile: ellipsis menu ── */}
              <div className="flex lg:hidden items-center ml-auto">
                <CardActions
                  mobileOnly
                  actions={[
                    {
                      key: 'editar',
                      label: tc('editar'),
                      icon: <Pencil className="size-4" />,
                      onClick: () => router.push(`/admin/profesores/${p.id}/editar`),
                    },
                    ...(p.rol !== 'admin' ? [{
                      key: 'toggle',
                      label: p.activo ? tp('deshabilitar') : tp('habilitar'),
                      icon: p.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />,
                      onClick: () => setConfirmAction({ id: p.id, nombre: nombreCompleto(p), activo: p.activo }),
                      danger: p.activo,
                    } as CardAction] : []),
                    {
                      key: 'ver_alumnos',
                      label: tp('ver_alumnos'),
                      icon: <Eye className="size-4" />,
                      onClick: () => router.push(`/admin/alumnos?profesor_id=${p.id}`),
                    },
                    {
                      key: 'ver_clases',
                      label: tp('ver_clases'),
                      icon: <BookOpen className="size-4" />,
                      onClick: () => router.push(`/admin/profesores/${p.id}/horarios`),
                    },
                    {
                      key: 'ver_agenda',
                      label: tp('ver_agenda'),
                      icon: <CalendarRange className="size-4" />,
                      onClick: () => router.push(`/admin/profesores/${p.id}/horarios?tab=agenda`),
                    },
                  ]}
                />
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Confirm enable/disable */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.activo ? tp('deshabilitar_titulo') : tp('habilitar_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>{tc('cancelar')}</Button>
            <Button variant={confirmAction?.activo ? 'danger' : 'primary'} onClick={handleToggle}>
              {confirmAction?.activo ? tp('deshabilitar') : tp('habilitar')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-primary)]">
          {confirmAction?.activo
            ? tp('confirm_deshabilitar', { nombre: confirmAction.nombre })
            : tp('confirm_habilitar', { nombre: confirmAction?.nombre ?? '' })}
        </p>
      </Modal>
    </div>
  );
}
