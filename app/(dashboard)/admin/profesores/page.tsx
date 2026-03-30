'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck, UserX, Eye, Copy, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Modal } from '@/components/common/Modal';
import Link from 'next/link';

type Profesor = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  rol: string;
  alumnos_count: number;
};

export default function ProfesoresPage() {
  const queryClient = useQueryClient();
  const { data: profesores = [], isLoading: loading } = useQuery<Profesor[]>({
    queryKey: ['admin-profesores'],
    queryFn: async () => {
      const res = await fetch('/api/admin/profesores');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60_000,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; nombre: string; activo: boolean } | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  // Create form state
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editModal, setEditModal] = useState<Profesor | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEdit = (p: Profesor) => {
    setEditModal(p);
    setEditNombre(p.nombre);
    setEditApellido(p.apellido);
    setEditTelefono(p.telefono ?? '');
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/profesores/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre, apellido: editApellido, telefono: editTelefono }),
      });
      if (!res.ok) throw new Error();
      toast.success('Profesor actualizado');
      setEditModal(null);
      queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
    } catch {
      toast.error('Error al actualizar profesor');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!nombre || !apellido || !email) {
      toast.error('Nombre, apellido y email son requeridos');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/profesores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, email, telefono }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Profesor creado correctamente');
      setCreatedPassword(data.temp_password);
      setFormOpen(false);
      setNombre(''); setApellido(''); setEmail(''); setTelefono('');
      queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear profesor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async () => {
    if (!confirmAction) return;
    try {
      const res = await fetch(`/api/admin/profesores/${confirmAction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !confirmAction.activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(confirmAction.activo ? 'Profesor deshabilitado' : 'Profesor habilitado');
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin-profesores'] });
    } catch {
      toast.error('Error al actualizar profesor');
    }
  };

  const copyPassword = () => {
    if (createdPassword) {
      navigator.clipboard.writeText(createdPassword);
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 2000);
    }
  };

  return (
    <div>
      <PageHeader
        title="Profesores"
        subtitle="Gestión de profesores"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar profesor
          </Button>
        }
      />

      <div className="mt-[var(--space-lg)] space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
          </div>
        ) : profesores.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-[var(--color-text-muted)]">No hay profesores registrados</p>
          </Card>
        ) : (
          profesores.map((p) => (
            <Card key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar nombre={p.nombre} apellido={p.apellido} avatarUrl={p.avatar_url} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[var(--color-text-primary)]">{p.nombre} {p.apellido}</p>
                    {p.rol === 'admin' ? (
                      <span className="rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">Admin</span>
                    ) : (
                      <StatusBadge status={p.activo ? 'activo' : 'inactivo'} />
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">{p.email}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{p.alumnos_count} alumnos asignados</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto sm:ml-0">
                <button
                  onClick={() => openEdit(p)}
                  title="Editar"
                  className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {p.rol !== 'admin' && (
                  <button
                    onClick={() => setConfirmAction({ id: p.id, nombre: `${p.nombre} ${p.apellido}`, activo: p.activo })}
                    className={`flex items-center gap-1 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition-colors ${
                      p.activo
                        ? 'border-[var(--color-error)] text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20'
                        : 'border-[var(--color-success)] text-[var(--color-success)] hover:bg-green-50 dark:hover:bg-green-950/20'
                    }`}
                  >
                    {p.activo ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                    {p.activo ? 'Deshabilitar' : 'Habilitar'}
                  </button>
                )}
                <Link
                  href={`/admin/alumnos?profesor_id=${p.id}`}
                  className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver alumnos
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Edit profesor modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title="Editar profesor"
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
        </div>
      </Modal>

      {/* Create profesor modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo Profesor"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={submitting}>Crear profesor</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Apellido</label>
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm" />
          </div>
        </div>
      </Modal>

      {/* Confirm enable/disable */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.activo ? 'Deshabilitar profesor' : 'Habilitar profesor'}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button variant={confirmAction?.activo ? 'danger' : 'primary'} onClick={handleToggle}>
              {confirmAction?.activo ? 'Deshabilitar' : 'Habilitar'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-primary)]">
          {confirmAction?.activo
            ? `¿Deshabilitar a ${confirmAction.nombre}? Sus alumnos seguirán activos.`
            : `¿Habilitar a ${confirmAction?.nombre}? Podrá volver a acceder al sistema.`}
        </p>
      </Modal>

      {/* Password reveal modal */}
      <Modal
        open={!!createdPassword}
        onClose={() => { setCreatedPassword(null); setCopiedPw(false); }}
        title="Profesor creado"
        footer={
          <Button onClick={() => { setCreatedPassword(null); setCopiedPw(false); }}>Entendido</Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            El profesor fue creado. Comparte esta contraseña temporal:
          </p>
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 font-mono text-sm">
            <span className="flex-1 break-all">{createdPassword}</span>
            <button onClick={copyPassword} className="shrink-0 rounded p-1 hover:bg-[var(--color-border)]">
              {copiedPw ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Esta contraseña solo se muestra una vez. El profesor deberá cambiarla al iniciar sesión.
          </p>
        </div>
      </Modal>
    </div>
  );
}
