'use client';

import { Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserX, UserCheck, ArrowRight, GraduationCap, Copy, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import { FichaAlumno } from '@/components/alumnos/FichaAlumno';
import type { AlumnoConExtra } from '@/components/alumnos/AlumnoCard';
import { useQueryParam } from '@/lib/hooks/useQueryParam';

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

  // Ficha alumno modal
  const [fichaAlumno, setFichaAlumno] = useState<AlumnoConExtra | null>(null);

  function toFichaAlumno(a: AlumnoAdmin): AlumnoConExtra {
    return {
      id: a.id,
      nombre: a.nombre,
      apellido: a.apellido,
      apellido_materno: null,
      email: a.email,
      telefono: a.telefono,
      avatar_url: a.avatar_url,
      activo: a.activo,
      rol: 'alumno' as const,
      created_at: '',
      updated_at: '',
      alumnos_extra: a.profesor_id
        ? [{
            id: '',
            alumno_id: a.id,
            profesor_id: a.profesor_id,
            universidad: a.universidad ?? null,
            año_ingreso: a.año_ingreso ?? null,
            notas: a.notas ?? null,
            paso_prueba: a.paso_prueba,
            fecha_prueba: a.fecha_prueba ?? null,
            created_at: '',
            updated_at: '',
          }]
        : null,
    };
  }

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

  // Create form
  const [formOpen, setFormOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [profesorId, setProfesorId] = useState('');
  const [universidad, setUniversidad] = useState('');
  const [anioIngreso, setAnioIngreso] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<AlumnoAdmin | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editUniversidad, setEditUniversidad] = useState('');
  const [editAno, setEditAno] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Action modals
  const [confirmBlock, setConfirmBlock] = useState<AlumnoAdmin | null>(null);
  const [reassign, setReassign] = useState<AlumnoAdmin | null>(null);
  const [newProfesorId, setNewProfesorId] = useState('');
  const [graduateModal, setGraduateModal] = useState<AlumnoAdmin | null>(null);
  const [fechaPrueba, setFechaPrueba] = useState(new Date().toISOString().split('T')[0]);

  const handleCreate = async () => {
    if (!nombre || !apellido || !email) {
      toast.error('Nombre, apellido y email son requeridos');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/alumnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, email, telefono, profesor_id: profesorId || null, universidad, año_ingreso: anioIngreso }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Alumno creado correctamente');
      setCreatedPassword(data.temp_password);
      setFormOpen(false);
      setNombre(''); setApellido(''); setEmail(''); setTelefono('');
      setProfesorId(''); setUniversidad(''); setAnioIngreso('');
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear alumno');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!confirmBlock) return;
    try {
      const res = await fetch(`/api/admin/alumnos/${confirmBlock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !confirmBlock.activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(confirmBlock.activo ? 'Alumno bloqueado' : 'Alumno desbloqueado');
      setConfirmBlock(null);
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error('Error al actualizar alumno');
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
      toast.success('Alumno reasignado');
      setReassign(null);
      setNewProfesorId('');
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error('Error al reasignar');
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
      toast.success('Alumno marcado como graduado 🎓');
      setGraduateModal(null);
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error('Error al graduar alumno');
    }
  };

  const copyPassword = () => {
    if (createdPassword) {
      navigator.clipboard.writeText(createdPassword);
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 2000);
    }
  };

  const openEdit = (a: AlumnoAdmin) => {
    setEditModal(a);
    setEditNombre(a.nombre);
    setEditApellido(a.apellido);
    setEditTelefono(a.telefono || '');
    setEditUniversidad(a.universidad || '');
    setEditAno(a.año_ingreso || '');
    setEditNotas(a.notas || '');
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/alumnos/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editNombre,
          apellido: editApellido,
          telefono: editTelefono || null,
          universidad: editUniversidad || null,
          año_ingreso: editAno || null,
          notas: editNotas || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Información actualizada');
      setEditModal(null);
      queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setEditSubmitting(false);
    }
  };

  const getAlumnoStatus = (a: AlumnoAdmin) => {
    if (!a.activo) return 'bloqueado' as const;
    if (a.paso_prueba) return 'graduado' as const;
    return 'activo' as const;
  };

  return (
    <div>
      <PageHeader
        title="Alumnos"
        subtitle="Gestión global de alumnos"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar alumno
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
            placeholder="Buscar alumno..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={estadoFilter || ''}
          onChange={(e) => setEstadoFilter(e.target.value || null)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="bloqueado">Bloqueados</option>
          <option value="graduado">Graduados</option>
        </select>
        <select
          value={profesorFilter || ''}
          onChange={(e) => setProfesorFilter(e.target.value || null)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">Todos los profesores</option>
          {profesores.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
          ))}        </select>
      </div>

      {/* Table / Cards */}
      <div className="mt-[var(--space-md)]">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : alumnos.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">No hay alumnos que coincidan con los filtros</p>
          </Card>
        ) : (
          <>
            {/* ── Mobile: card list (< md) ── */}
            <div className="space-y-[var(--space-sm)] md:hidden">
              {alumnos.map((a) => (
                <div
                  key={a.id}
                  className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-md)] transition-colors hover:bg-[var(--color-bg-secondary)]"
                  onClick={() => setFichaAlumno(toFichaAlumno(a))}
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
                    <button
                      onClick={() => openEdit(a)}
                      title="Editar"
                      className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setReassign(a); setNewProfesorId(a.profesor_id || ''); }}
                      title="Reasignar profesor"
                      className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    {!a.paso_prueba && a.activo && (
                      <button
                        onClick={() => setGraduateModal(a)}
                        title="Marcar graduado"
                        className="cursor-pointer rounded p-1.5 text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]"
                      >
                        <GraduationCap className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmBlock(a)}
                      title={a.activo ? 'Bloquear' : 'Desbloquear'}
                      className={`cursor-pointer rounded p-1.5 ${a.activo ? 'text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20' : 'text-[var(--color-success)] hover:bg-green-50 dark:hover:bg-green-950/20'}`}
                    >
                      {a.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
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
                      <th className="px-4 py-3">Alumno</th>
                      <th className="px-4 py-3">Profesor</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 hidden lg:table-cell">Universidad</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnos.map((a) => (
                      <tr
                        key={a.id}
                        className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
                        onClick={() => setFichaAlumno(toFichaAlumno(a))}
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
                            <button
                              onClick={() => openEdit(a)}
                              title="Editar"
                              className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setReassign(a); setNewProfesorId(a.profesor_id || ''); }}
                              title="Reasignar"
                              className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                            >
                              <ArrowRight className="h-4 w-4" />
                            </button>
                            {!a.paso_prueba && a.activo && (
                              <button
                                onClick={() => setGraduateModal(a)}
                                title="Marcar graduado"
                                className="cursor-pointer rounded p-1.5 text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]"
                              >
                                <GraduationCap className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmBlock(a)}
                              title={a.activo ? 'Bloquear' : 'Desbloquear'}
                              className={`cursor-pointer rounded p-1.5 ${a.activo ? 'text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20' : 'text-[var(--color-success)] hover:bg-green-50 dark:hover:bg-green-950/20'}`}
                            >
                              {a.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
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

      {/* Ficha alumno */}
      <FichaAlumno
        alumno={fichaAlumno}
        open={!!fichaAlumno}
        onClose={() => {
          setFichaAlumno(null);
          queryClient.invalidateQueries({ queryKey: ['admin-alumnos'] });
        }}
      />

      {/* Edit alumno modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title="Editar alumno"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button onClick={handleEdit} loading={editSubmitting}>Guardar cambios</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Nombre</label>
              <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Apellido</label>
              <input value={editApellido} onChange={(e) => setEditApellido(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Teléfono</label>
            <input value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Universidad</label>
              <input value={editUniversidad} onChange={(e) => setEditUniversidad(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Año de ingreso</label>
              <input type="number" value={editAno} onChange={(e) => setEditAno(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Notas del alumno</label>
            <textarea rows={3} value={editNotas} onChange={(e) => setEditNotas(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm resize-none" />
          </div>
        </div>
      </Modal>

      {/* Create alumno modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo Alumno"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={submitting}>Crear alumno</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Apellido</label>
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Asignar a profesor</label>
            <select value={profesorId} onChange={(e) => setProfesorId(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm">
              <option value="">Sin asignar</option>
              {profesores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Universidad</label>
              <input value={universidad} onChange={(e) => setUniversidad(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Año de ingreso</label>
              <input type="number" value={anioIngreso} onChange={(e) => setAnioIngreso(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Block/Unblock confirm */}
      <Modal
        open={!!confirmBlock}
        onClose={() => setConfirmBlock(null)}
        title={confirmBlock?.activo ? 'Bloquear alumno' : 'Desbloquear alumno'}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmBlock(null)}>Cancelar</Button>
            <Button variant={confirmBlock?.activo ? 'danger' : 'primary'} onClick={handleToggleBlock}>
              {confirmBlock?.activo ? 'Bloquear' : 'Desbloquear'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-primary)]">
          {confirmBlock?.activo
            ? `¿Bloquear a ${confirmBlock.nombre} ${confirmBlock.apellido}? No podrá acceder al sistema.`
            : `¿Desbloquear a ${confirmBlock?.nombre} ${confirmBlock?.apellido}?`}
        </p>
      </Modal>

      {/* Reassign modal */}
      <Modal
        open={!!reassign}
        onClose={() => setReassign(null)}
        title="Reasignar alumno"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setReassign(null)}>Cancelar</Button>
            <Button onClick={handleReassign} disabled={!newProfesorId}>Reasignar</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            Reasignar a <strong>{reassign?.nombre} {reassign?.apellido}</strong>:
          </p>
          <select
            value={newProfesorId}
            onChange={(e) => setNewProfesorId(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
          >
            <option value="">Seleccionar profesor</option>
            {profesores.filter((p) => p.rol !== 'admin' || p.id !== reassign?.profesor_id).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
            ))}
          </select>
        </div>
      </Modal>

      {/* Graduate modal */}
      <Modal
        open={!!graduateModal}
        onClose={() => setGraduateModal(null)}
        title="🎓 Marcar como graduado"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setGraduateModal(null)}>Cancelar</Button>
            <Button onClick={handleGraduate}>Confirmar graduación</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            ¿Marcar a <strong>{graduateModal?.nombre} {graduateModal?.apellido}</strong> como graduado?
          </p>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Fecha de la prueba</label>
            <input
              type="date"
              value={fechaPrueba}
              onChange={(e) => setFechaPrueba(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>

      {/* Password reveal modal */}
      <Modal
        open={!!createdPassword}
        onClose={() => { setCreatedPassword(null); setCopiedPw(false); }}
        title="Alumno creado"
        footer={<Button onClick={() => { setCreatedPassword(null); setCopiedPw(false); }}>Entendido</Button>}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            El alumno fue creado. Comparte esta contraseña temporal:
          </p>
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 font-mono text-sm">
            <span className="flex-1 break-all">{createdPassword}</span>
            <button onClick={copyPassword} className="shrink-0 rounded p-1 hover:bg-[var(--color-border)]">
              {copiedPw ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
            </button>
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
