'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, BookOpen, Archive, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ProgramaCard } from '@/components/programas/ProgramaCard';
import { ProgramaForm } from '@/components/programas/ProgramaForm';
import {
  useProgramas,
  useCrearPrograma,
  useEliminarPrograma,
  useEliminarProgramaDefinitivo,
  useRestaurarPrograma,
  useEditarPrograma,
} from '@/lib/hooks/useProgramas';
import { useUser } from '@/lib/hooks/useUser';
import { useRouter } from 'next/navigation';
import type { ProgramaClase, ProgramaClaseConConteo } from '@/lib/supabase/types';

export default function ProfesorProgramasPage() {
  const t = useTranslations('programas');
  const { user } = useUser();
  const router = useRouter();

  const { data: programas = [], isLoading } = useProgramas('todos');
  const crearPrograma = useCrearPrograma();
  const editarPrograma = useEditarPrograma();
  const eliminarPrograma = useEliminarPrograma();
  const eliminarDefinitivo = useEliminarProgramaDefinitivo();
  const restaurarPrograma = useRestaurarPrograma();

  const [formOpen, setFormOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<ProgramaClase | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // Soft-delete confirmation
  const [deleteConfirmPrograma, setDeleteConfirmPrograma] = useState<ProgramaClaseConConteo | null>(null);
  // Hard-delete confirmation
  const [hardDeletePrograma, setHardDeletePrograma] = useState<ProgramaClaseConConteo | null>(null);

  const misActivos = programas.filter(
    (p) => p.estado === 'activo' && p.created_by === user?.id
  );
  const otrosActivos = programas.filter(
    (p) => p.estado === 'activo' && p.created_by !== user?.id
  );
  const eliminados = programas.filter((p) => p.estado === 'eliminado' && p.created_by === user?.id);

  const handleCreate = async (data: { nombre: string; descripcion?: string | null; profesor_id?: string | null }) => {
    try {
      await crearPrograma.mutateAsync(data);
      toast.success(t('mensajes.creado'));
    } catch {
      toast.error(t('mensajes.error_crear'));
    }
  };

  const handleEdit = async (data: { nombre: string; descripcion?: string | null; profesor_id?: string | null }) => {
    if (!editingPrograma) return;
    try {
      await editarPrograma.mutateAsync({ id: editingPrograma.id, ...data });
      toast.success(t('mensajes.actualizado'));
    } catch {
      toast.error(t('mensajes.error_editar'));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmPrograma) return;
    try {
      await eliminarPrograma.mutateAsync(deleteConfirmPrograma.id);
      toast.success(t('mensajes.eliminado'));
      setDeleteConfirmPrograma(null);
    } catch {
      toast.error(t('mensajes.error_eliminar'));
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeletePrograma) return;
    try {
      await eliminarDefinitivo.mutateAsync(hardDeletePrograma.id);
      toast.success(t('mensajes.eliminado'));
      setHardDeletePrograma(null);
    } catch {
      toast.error(t('mensajes.error_eliminar'));
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restaurarPrograma.mutateAsync(id);
      toast.success(t('mensajes.restaurado'));
    } catch {
      toast.error(t('mensajes.error_restaurar'));
    }
  };

  const p = deleteConfirmPrograma;
  const hasClases = (p?.total_clases ?? 0) > 0;
  const hasAlumnos = (p?.total_asignados ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo')}
        actions={
          <Button onClick={() => { setEditingPrograma(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 size-4" />
            {t('crear')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center py-12">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      ) : (
        <div className="mt-[var(--space-lg)] flex flex-col gap-8">
          {/* Mis programas */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="size-4 text-[var(--color-brand-gold)]" />
              <h2 className="font-semibold text-[var(--color-text-primary)]">{t('mis_programas')}</h2>
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                {misActivos.length}
              </span>
            </div>
            {misActivos.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">{t('sin_programas')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {misActivos.map((p) => (
                  <ProgramaCard
                    key={p.id}
                    programa={p}
                    canEdit
                    onClick={() => router.push(`/profesor/programas/${p.id}`)}
                    onEdit={() => { setEditingPrograma(p as unknown as ProgramaClase); setFormOpen(true); }}
                    onDelete={() => setDeleteConfirmPrograma(p)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Otros profesores */}
          {otrosActivos.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList className="size-4 text-[var(--color-text-muted)]" />
                <h2 className="font-semibold text-[var(--color-text-primary)]">{t('otros_profesores')}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otrosActivos.map((p) => (
                  <ProgramaCard
                    key={p.id}
                    programa={p}
                    canEdit={false}
                    onClick={() => router.push(`/profesor/programas/${p.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Papelera */}
          {eliminados.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowDeleted((v) => !v)}
                className="mb-3 flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <Archive className="size-4" />
                {t('papelera')} ({eliminados.length})
                <span className="text-xs">{showDeleted ? '▲' : '▼'}</span>
              </button>
              {showDeleted && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {eliminados.map((p) => (
                    <ProgramaCard
                      key={p.id}
                      programa={p}
                      canEdit
                      onRestore={() => handleRestore(p.id)}
                      onHardDelete={() => setHardDeletePrograma(p)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Soft-delete confirmation modal */}
      <Modal
        open={!!deleteConfirmPrograma}
        onClose={() => setDeleteConfirmPrograma(null)}
        title={t('confirmar_eliminar')}
        preventOutsideClose
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteConfirmPrograma(null)} disabled={eliminarPrograma.isPending}>
              {t('cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={eliminarPrograma.isPending}>
              {t('eliminar_tooltip')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('confirmar_eliminar_desc')}
          </p>

          {/* Impact list */}
          {(hasClases || hasAlumnos) && (
            <div className="flex flex-col gap-2">
              {hasClases && (
                <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-gold)]" />
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('confirmar_eliminar_impacto_clases', { clases: t('n_clases', { count: p?.total_clases ?? 0 }) })}
                  </p>
                </div>
              )}
              {hasAlumnos && (
                <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
                  <ClipboardList className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-gold)]" />
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('confirmar_eliminar_impacto_alumnos', { alumnos: t('n_asignados', { count: p?.total_asignados ?? 0 }) })}
                  </p>
                </div>
              )}
            </div>
          )}

          {(hasClases || hasAlumnos) && (
            <div className="rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 px-3 py-2">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                ⚠ {t('confirmar_eliminar_advertencia')}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Hard-delete confirmation modal */}
      <Modal
        open={!!hardDeletePrograma}
        onClose={() => setHardDeletePrograma(null)}
        title={t('eliminar_definitivo_titulo')}
        preventOutsideClose
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="ghost" onClick={() => setHardDeletePrograma(null)} disabled={eliminarDefinitivo.isPending}>
              {t('cancelar')}
            </Button>
            <Button variant="danger" onClick={handleHardDelete} loading={eliminarDefinitivo.isPending}>
              {t('eliminar_definitivo_confirmar')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t('eliminar_definitivo_desc', { nombre: hardDeletePrograma?.nombre ?? '' })}
        </p>
      </Modal>

      <ProgramaForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={editingPrograma ? handleEdit : handleCreate}
        programa={editingPrograma}
        loading={crearPrograma.isPending || editarPrograma.isPending}
      />
    </div>
  );
}
