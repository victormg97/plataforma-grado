'use client';

import { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, UserX, UserCheck, ArrowRight, GraduationCap, Copy, Check, Pencil, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';

import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/components/common/Tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

type AlumnoAdmin = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  profesor_id: string | null;
  profesor: { id: string; nombre: string; apellido: string } | null;
  universidad: string | null;
  año_ingreso: string | null;
  notas: string | null;
  paso_prueba: boolean;
  fecha_prueba: string | null;
  estado_cuenta?: 'Pendiente' | 'Activo';
};

type ProfesorOption = {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  rol: string;
};

function AdminAlumnosContent() {
  const queryClient = useQueryClient();
  const ta = useTranslations('alumnos');
  const tc = useTranslations('common');
  const router = useRouter();

  // Filters via URL
  const [q, setQ] = useQueryParam('q');
  const [estadoFilter, setEstadoFilter] = useQueryParam('estado');
  const [profesorFilter, setProfesorFilter] = useQueryParam('profesor_id');

  // Local search state — debounce URL update to avoid router.replace on every keystroke
  const [searchText, setSearchText] = useState(q || '');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sync URL → local on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSearchText(q || ''); }, []);

  // Data via React Query
  const { data: allAlumnos = [], isLoading: loading } = useQuery<AlumnoAdmin[]>({
    queryKey: ['admin-alumnos'],
    queryFn: async () => {
      const res = await fetch('/api/admin/alumnos');
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60_000,
  });

  const { data: profesores = [] } = useQuery<ProfesorOption[]>({
    queryKey: ['admin-profesores'],
    queryFn: async () => {
      const res = await fetch('/api/admin/profesores');
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60_000,
  });

  // Ficha alumno — navigate to full page
  const openFicha = (alumnoId: string) => router.push(`/admin/alumnos/${alumnoId}`);

  // Client-side filtering (instant, no network call per keystroke)
  const alumnos = useMemo(() => {
    let result = allAlumnos;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (a) =>
          a.nombre.toLowerCase().includes(lower) ||
          a.apellido.toLowerCase().includes(lower) ||
          `${a.nombre} ${a.apellido}`.toLowerCase().includes(lower) ||
          a.email.toLowerCase().includes(lower)
      );
    }
    if (estadoFilter === 'bloqueado') result = result.filter((a) => !a.activo);
    else if (estadoFilter === 'activo') result = result.filter((a) => a.activo && !a.paso_prueba);
    else if (estadoFilter === 'graduado') result = result.filter((a) => a.paso_prueba);
    if (profesorFilter) result = result.filter((a) => a.profesor_id === profesorFilter);
    return result;
  }, [allAlumnos, searchText, estadoFilter, profesorFilter]);

  const activeProfesores = useMemo(() => profesores.filter((p) => p.activo), [profesores]);

  // Action modals
  const [confirmBlock, setConfirmBlock] = useState<AlumnoAdmin | null>(null);
  const [reassign, setReassign] = useState<AlumnoAdmin | null>(null);
  const [newProfesorId, setNewProfesorId] = useState('');
  const [graduateModal, setGraduateModal] = useState<AlumnoAdmin | null>(null);
  const [fechaPrueba, setFechaPrueba] = useState(new Date().toISOString().split('T')[0]);


  const handleToggleBlock = async () => {
    if (!confirmBlock) return;
    try {
      const res = await fetch(`/api/admin/alumnos/${confirmBlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !confirmBlock.activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(confirmBlock.activo ? ta('exito_bloqueado') : ta('exito_desbloqueado'));
      setConfirmBlock(null);
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error(ta('error_actualizar'));
    }
  };

  const handleReassign = async () => {
    if (!reassign || !newProfesorId) return;
    try {
      const res = await fetch(`/api/admin/alumnos/${reassign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profesor_id: newProfesorId }),
      });
      if (!res.ok) throw new Error();
      toast.success(ta('exito_reasignado'));
      setReassign(null);
      setNewProfesorId('');
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error(ta('error_reasignar'));
    }
  };

  const handleGraduate = async () => {
    if (!graduateModal) return;
    try {
      const res = await fetch(`/api/admin/alumnos/${graduateModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paso_prueba: true, fecha_prueba: fechaPrueba }),
      });
      if (!res.ok) throw new Error();
      toast.success(ta('confirmar_graduacion'));
      setGraduateModal(null);
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error(ta('error_actualizar'));
    }
  };



  const getAlumnoStatus = (a: AlumnoAdmin) => {
    if (a.estado_cuenta === 'Pendiente') return 'pendiente' as const;
    if (!a.activo) return 'bloqueado' as const;
    if (a.paso_prueba) return 'graduado' as const;
    return 'activo' as const;
  };

  return (
    <div>
      <PageHeader
        title={ta('titulo')}
        subtitle={ta('subtitulo')}
        actions={
          <Button onClick={() => router.push('/admin/alumnos/crear')}>
            <Plus className="mr-1.5 h-4 w-4" />
            {ta('nuevo_alumno')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="mt-[var(--space-lg)] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            value={searchText}
            onChange={(e) => {
              const val = e.target.value;
              setSearchText(val);
              if (searchDebounce.current) clearTimeout(searchDebounce.current);
              searchDebounce.current = setTimeout(() => setQ(val || null), 400);
            }}
            placeholder={ta('buscar_placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm min-w-[160px]">
            <span>
              {estadoFilter === 'activo' ? ta('estado_activo')
                : estadoFilter === 'bloqueado' ? ta('estado_bloqueado')
                : estadoFilter === 'graduado' ? ta('estado_graduado')
                : ta('todos_estados')}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setEstadoFilter(null)}>{ta('todos_estados')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEstadoFilter('activo')}>{ta('estado_activo')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEstadoFilter('bloqueado')}>{ta('estado_bloqueado')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEstadoFilter('graduado')}>{ta('estado_graduado')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm min-w-[180px]">
            <span className="truncate">
              {(() => {
                const p = profesores.find((p) => p.id === profesorFilter);
                return p ? `${p.nombre} ${p.apellido}` : ta('todos_profesores');
              })()}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setProfesorFilter(null)}>{ta('todos_profesores')}</DropdownMenuItem>
            {profesores.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setProfesorFilter(p.id)}>{p.nombre} {p.apellido}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table / Cards */}
      <div className="mt-[var(--space-md)]">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : alumnos.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">{ta('no_coinciden')}</p>
          </Card>
        ) : (
          <>
            {/* ── Mobile: card list (< md) ── */}
            <div className="space-y-[var(--space-sm)] md:hidden">
              {alumnos.map((a) => (
                <div
                  key={a.id}
                  className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-md)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                  onClick={() => openFicha(a.id)}
                >
                  {/* Info row */}
                  <div className="flex items-center gap-3">
                    <Avatar nombre={a.nombre} apellido={a.apellido} avatarUrl={a.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--color-text-primary)] truncate">{a.nombre} {a.apellido}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{a.email}</p>
                      {a.profesor && (
                        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                          Prof. {a.profesor.nombre} {a.profesor.apellido}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={getAlumnoStatus(a)} />
                  </div>

                  {/* Actions row */}
                  <div
                    className="mt-[var(--space-sm)] flex items-center justify-end gap-1 border-t border-[var(--color-border)] pt-[var(--space-sm)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Tooltip content={tc('editar')}>
                      <button
                        onClick={() => router.push(`/admin/alumnos/${a.id}/editar`)}
                        className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content={ta('reasignar_titulo')}>
                      <button
                        onClick={() => { setReassign(a); setNewProfesorId(a.profesor_id || ''); }}
                        className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    {!a.paso_prueba && a.activo && (
                      <Tooltip content={ta('graduar_titulo')}>
                        <button
                          onClick={() => setGraduateModal(a)}
                          className="cursor-pointer rounded p-1.5 text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]"
                        >
                          <GraduationCap className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip content={a.activo ? ta('bloquear') : ta('desbloquear')}>
                      <button
                        onClick={() => setConfirmBlock(a)}
                        className={`cursor-pointer rounded p-1.5 ${a.activo ? 'text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20' : 'text-[var(--color-success)] hover:bg-green-50 dark:hover:bg-green-950/20'}`}
                      >
                        {a.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop: table (md+) ── */}
            <div className="hidden md:block overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-left text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                      <th className="px-4 py-3">{ta('col_alumno')}</th>
                      <th className="px-4 py-3">{ta('col_profesor')}</th>
                      <th className="px-4 py-3">{tc('estado')}</th>
                      <th className="px-4 py-3 hidden lg:table-cell">{ta('col_universidad')}</th>
                      <th className="px-4 py-3 text-right">{ta('col_acciones')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.map((a) => (
                      <tr
                        key={a.id}
                        className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
                        onClick={() => openFicha(a.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar nombre={a.nombre} apellido={a.apellido} avatarUrl={a.avatar_url} size="sm" />
                            <div>
                              <p className="font-medium text-[var(--color-text-primary)]">{a.nombre} {a.apellido}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">{a.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {a.profesor ? (
                            <span className="text-[var(--color-text-primary)]">{a.profesor.nombre} {a.profesor.apellido}</span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={getAlumnoStatus(a)} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)]">
                          {a.universidad || '—'}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip content={tc('editar')}>
                              <button
                                onClick={() => router.push(`/admin/alumnos/${a.id}/editar`)}
                                className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </Tooltip>
                            <Tooltip content={ta('reasignar_titulo')}>
                              <button
                                onClick={() => { setReassign(a); setNewProfesorId(a.profesor_id || ''); }}
                                className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </Tooltip>
                            {!a.paso_prueba && a.activo && (
                              <Tooltip content={ta('graduar_titulo')}>
                                <button
                                  onClick={() => setGraduateModal(a)}
                                  className="cursor-pointer rounded p-1.5 text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]"
                                >
                                  <GraduationCap className="h-4 w-4" />
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip content={a.activo ? ta('bloquear') : ta('desbloquear')}>
                              <button
                                onClick={() => setConfirmBlock(a)}
                                className={`cursor-pointer rounded p-1.5 ${a.activo ? 'text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20' : 'text-[var(--color-success)] hover:bg-green-50 dark:hover:bg-green-950/20'}`}
                              >
                                {a.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </button>
                            </Tooltip>
                          </div>
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

      {/* Block/Unblock confirm */}
      <Modal
        open={!!confirmBlock}
        onClose={() => setConfirmBlock(null)}
        title={confirmBlock?.activo ? ta('bloquear_titulo') : ta('desbloquear_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmBlock(null)}>{tc('cancelar')}</Button>
            <Button variant={confirmBlock?.activo ? 'danger' : 'primary'} onClick={handleToggleBlock}>
              {confirmBlock?.activo ? ta('bloquear_btn') : ta('desbloquear_btn')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-primary)]">
          {confirmBlock?.activo
            ? ta('confirm_bloquear', { nombre: `${confirmBlock.nombre} ${confirmBlock.apellido}` })
            : ta('confirm_desbloquear', { nombre: `${confirmBlock?.nombre} ${confirmBlock?.apellido}` })}
        </p>
      </Modal>

      {/* Reassign modal */}
      <Modal
        open={!!reassign}
        onClose={() => setReassign(null)}
        title={ta('reasignar_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setReassign(null)}>{tc('cancelar')}</Button>
            <Button onClick={handleReassign} disabled={!newProfesorId}>{ta('reasignar_btn')}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            {ta('reasignar_texto', { nombre: `${reassign?.nombre} ${reassign?.apellido}` })}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm">
              <span className="truncate">
                {(() => {
                  const p = profesores.find((p) => p.id === newProfesorId);
                  return p ? `${p.nombre} ${p.apellido}` : ta('seleccionar_profesor');
                })()}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setNewProfesorId('')}>{ta('seleccionar_profesor')}</DropdownMenuItem>
              {profesores.filter((p) => p.rol !== 'admin' || p.id !== reassign?.profesor_id).map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => setNewProfesorId(p.id)}>{p.nombre} {p.apellido}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Modal>

      {/* Graduate modal */}
      <Modal
        open={!!graduateModal}
        onClose={() => setGraduateModal(null)}
        title={ta('graduar_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setGraduateModal(null)}>{tc('cancelar')}</Button>
            <Button onClick={handleGraduate}>{ta('confirmar_graduacion')}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            {ta('confirm_graduar', { nombre: `${graduateModal?.nombre} ${graduateModal?.apellido}` })}
          </p>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{ta('fecha_prueba')}</label>
            <input
              type="date"
              value={fechaPrueba}
              onChange={(e) => setFechaPrueba(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>


    </div>
  );
}

export default function AdminAlumnosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" /></div>}>
      <AdminAlumnosContent />
    </Suspense>
  );
}
