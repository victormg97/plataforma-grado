'use client';

import { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronDown, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';

import { useQueryParam } from '@/lib/hooks/useQueryParam';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { AlumnoMobileCard, AlumnoTableRow, type AlumnoAdmin } from './components';

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
  const te = useTranslations('enlaces');
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

  const getAlumnoStatus = (a: AlumnoAdmin): 'activo' | 'pendiente' | 'bloqueado' | 'graduado' => {
    return a.estado ?? 'activo';
  };

  // Client-side filtering (search + profesor only, estado handled by cards)
  const filteredAlumnos = useMemo(() => {
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
    if (profesorFilter) result = result.filter((a) => a.profesor_id === profesorFilter);
    return result;
  }, [allAlumnos, searchText, profesorFilter]);

  // Group alumnos by status
  const alumnosByStatus = useMemo(() => {
    const groups: Record<string, AlumnoAdmin[]> = {};
    for (const a of filteredAlumnos) {
      const status = getAlumnoStatus(a);
      if (!groups[status]) groups[status] = [];
      groups[status].push(a);
    }
    return groups;
  }, [filteredAlumnos]);

  // Get unique statuses that actually exist in the data — derived purely from the fetched data
  const existingStatuses = useMemo(() => {
    const statuses: string[] = [];
    const seen = new Set<string>();
    // 'activo' always first if present
    for (const a of allAlumnos) {
      const s = getAlumnoStatus(a);
      if (!seen.has(s)) {
        seen.add(s);
        statuses.push(s);
      }
    }
    // Sort: activo first, then the rest in order of first appearance
    statuses.sort((a, b) => {
      if (a === 'activo') return -1;
      if (b === 'activo') return 1;
      return 0;
    });
    return statuses;
  }, [allAlumnos]);

  // Determine which status cards to show
  const visibleStatuses = useMemo(() => {
    if (estadoFilter) {
      // When filtering, show only that status card
      return [estadoFilter];
    }
    // Always show 'activo' card, plus any other status that has items in the filtered set
    const result: string[] = ['activo'];
    for (const status of existingStatuses) {
      if (status !== 'activo' && alumnosByStatus[status] && alumnosByStatus[status].length > 0) {
        result.push(status);
      }
    }
    return result;
  }, [estadoFilter, existingStatuses, alumnosByStatus]);

  // Check if profesores have any data for the filter
  const hasMultipleProfesores = profesores.length > 1;
  const hasMultipleStatuses = existingStatuses.length > 1;

  // Action modals
  const [confirmBlock, setConfirmBlock] = useState<AlumnoAdmin | null>(null);
  const [blockMotivo, setBlockMotivo] = useState('');
  const [blockingInProgress, setBlockingInProgress] = useState(false);
  const [reassign, setReassign] = useState<AlumnoAdmin | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [newProfesorId, setNewProfesorId] = useState('');
  const [graduateModal, setGraduateModal] = useState<AlumnoAdmin | null>(null);
  const [graduating, setGraduating] = useState(false);
  const [fechaPrueba, setFechaPrueba] = useState(new Date().toISOString().split('T')[0]);


  const handleToggleBlock = async () => {
    if (!confirmBlock || blockingInProgress) return;
    try {
      setBlockingInProgress(true);
      const res = await fetch(`/api/admin/alumnos/${confirmBlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activo: !confirmBlock.activo,
          motivo: confirmBlock.activo ? (blockMotivo.trim() || null) : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(confirmBlock.activo ? ta('exito_bloqueado') : ta('exito_desbloqueado'));
      setConfirmBlock(null);
      setBlockMotivo('');
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error(ta('error_actualizar'));
    } finally {
      setBlockingInProgress(false);
    }
  };

  const handleReassign = async () => {
    if (!reassign || !newProfesorId || reassigning) return;
    try {
      setReassigning(true);
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
    } finally {
      setReassigning(false);
    }
  };

  const handleGraduate = async () => {
    if (!graduateModal || graduating) return;
    try {
      setGraduating(true);
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
    } finally {
      setGraduating(false);
    }
  };

  const renderStatusCard = (status: string) => {
    const items = alumnosByStatus[status] || [];
    const label = status.charAt(0).toUpperCase() + status.slice(1);

    // For 'activo', always show (even if empty with message)
    // For others, only show if there are items (already handled by visibleStatuses)
    if (status === 'activo' && items.length === 0 && !estadoFilter) {
      return (
        <div key={status}>
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            {label} ({items.length})
          </h2>
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">{ta('no_coinciden')}</p>
          </Card>
        </div>
      );
    }

    if (items.length === 0) {
      if (estadoFilter === status) {
        return (
          <div key={status}>
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              {label} ({items.length})
            </h2>
            <Card className="py-12 text-center">
              <p className="text-[var(--color-text-muted)]">{ta('no_coinciden')}</p>
            </Card>
          </div>
        );
      }
      return null;
    }

    return (
      <div key={status}>
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          {label} ({items.length})
        </h2>

        {/* Mobile: card list */}
        <div className="space-y-[var(--space-sm)] md:hidden">
          {items.map((a) => (
            <AlumnoMobileCard
              key={a.id}
              alumno={a}
              status={getAlumnoStatus(a) as 'activo' | 'pendiente' | 'bloqueado' | 'graduado'}
              onOpen={openFicha}
              onReassign={(al) => { setReassign(al); setNewProfesorId(al.profesor_id || ''); }}
              onGraduate={setGraduateModal}
              onToggleBlock={setConfirmBlock}
            />
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-left text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  <th className="px-4 py-3">{ta('col_alumno')}</th>
                  <th className="px-4 py-3">{ta('col_profesor')}</th>
                  <th className="px-4 py-3">{tc('estado')}</th>
                  <th className="px-4 py-3 hidden lg:table-cell">{ta('col_ultimo_acceso')}</th>
                  <th className="px-4 py-3 hidden xl:table-cell">{ta('col_universidad')}</th>
                  <th className="px-4 py-3 text-right">{ta('col_acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <AlumnoTableRow
                    key={a.id}
                    alumno={a}
                    status={getAlumnoStatus(a) as 'activo' | 'pendiente' | 'bloqueado' | 'graduado'}
                    onOpen={openFicha}
                    onReassign={(al) => { setReassign(al); setNewProfesorId(al.profesor_id || ''); }}
                    onGraduate={setGraduateModal}
                    onToggleBlock={setConfirmBlock}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title={ta('titulo')}
        subtitle={ta('subtitulo')}
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push('/enlaces-invitacion?from=/admin/alumnos')}>
              <Link2 className="mr-1.5 size-4" />
              {te('boton_enlace_invitacion')}
            </Button>
            <Button onClick={() => router.push('/admin/alumnos/crear')}>
              <Plus className="mr-1.5 size-4" />
              {ta('nuevo_alumno')}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="mt-[var(--space-lg)] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
          <input
            value={searchText}
            onChange={(e) => {
              const val = e.target.value;
              setSearchText(val);
              if (searchDebounce.current) clearTimeout(searchDebounce.current);
              searchDebounce.current = setTimeout(() => setQ(val || null), 400);
            }}
            placeholder={ta('buscar_placeholder')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasMultipleStatuses}
          >
            <span>
              {estadoFilter ? (estadoFilter.charAt(0).toUpperCase() + estadoFilter.slice(1)) : ta('todos_estados')}
            </span>
            <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setEstadoFilter(null)}>{ta('todos_estados')}</DropdownMenuItem>
            {existingStatuses.map((status) => (
              <DropdownMenuItem key={status} onClick={() => setEstadoFilter(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!hasMultipleProfesores}
          >
            <span className="truncate">
              {(() => {
                const p = profesores.find((p) => p.id === profesorFilter);
                return p ? `${p.nombre} ${p.apellido}` : ta('todos_profesores');
              })()}
            </span>
            <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setProfesorFilter(null)}>{ta('todos_profesores')}</DropdownMenuItem>
            {profesores.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setProfesorFilter(p.id)}>{p.nombre} {p.apellido}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status-grouped cards */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-lg)]">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : (
          visibleStatuses.map((status) => renderStatusCard(status))
        )}
      </div>

      {/* Block/Unblock confirm */}
      <Modal
        open={!!confirmBlock}
        onClose={() => { setConfirmBlock(null); setBlockMotivo(''); }}
        title={confirmBlock?.activo ? ta('bloquear_titulo') : ta('desbloquear_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setConfirmBlock(null); setBlockMotivo(''); }} disabled={blockingInProgress}>{tc('cancelar')}</Button>
            <Button variant={confirmBlock?.activo ? 'danger' : 'primary'} onClick={handleToggleBlock} disabled={blockingInProgress}>
              {blockingInProgress ? <><Loader2 className="size-4 mr-2 animate-spin" />{tc('cargando')}</> : (confirmBlock?.activo ? ta('bloquear_btn') : ta('desbloquear_btn'))}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            {confirmBlock?.activo
              ? ta('confirm_bloquear', { nombre: `${confirmBlock.nombre} ${confirmBlock.apellido}` })
              : ta('confirm_desbloquear', { nombre: `${confirmBlock?.nombre} ${confirmBlock?.apellido}` })}
          </p>
          {confirmBlock?.activo && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                {ta('bloquear_motivo')} <span className="text-[var(--color-text-muted)] font-normal">{tc('opcional')}</span>
              </label>
              <textarea
                value={blockMotivo}
                onChange={(e) => setBlockMotivo(e.target.value)}
                placeholder={ta('bloquear_motivo_placeholder')}
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)] resize-none"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Reassign modal */}
      <Modal
        open={!!reassign}
        onClose={() => setReassign(null)}
        title={ta('reasignar_titulo')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setReassign(null)} disabled={reassigning}>{tc('cancelar')}</Button>
            <Button onClick={handleReassign} disabled={!newProfesorId || reassigning}>
              {reassigning ? <><Loader2 className="size-4 mr-2 animate-spin" />{tc('cargando')}</> : ta('reasignar_btn')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            {ta('reasignar_texto', { nombre: `${reassign?.nombre} ${reassign?.apellido}` })}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm">
              <span className="truncate">
                {(() => {
                  const p = profesores.find((p) => p.id === newProfesorId);
                  return p ? `${p.nombre} ${p.apellido}` : ta('seleccionar_profesor');
                })()}
              </span>
              <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
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
            <Button variant="ghost" onClick={() => setGraduateModal(null)} disabled={graduating}>{tc('cancelar')}</Button>
            <Button onClick={handleGraduate} disabled={graduating}>
              {graduating ? <><Loader2 className="size-4 mr-2 animate-spin" />{tc('cargando')}</> : ta('confirmar_graduacion')}
            </Button>
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
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AdminAlumnosPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" /></div>}>
      <AdminAlumnosContent />
    </Suspense>
  );
}
