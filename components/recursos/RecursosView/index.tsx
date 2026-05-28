'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, FolderOpen, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { RecursoCard, type RecursoItem } from '@/components/recursos/RecursoCard';
import { RecursoUploader } from '@/components/recursos/RecursoUploader';
import { RecursoEditModal } from '@/components/recursos/RecursoEditModal';
import type { UserRol } from '@/lib/supabase/types';

interface Alumno {
  id: string;
  nombre: string;
  apellido: string;
}

interface RecursosViewProps {
  rol: UserRol;
}

type Tab = 'todos' | 'archivo' | 'enlace' | 'video';

export function RecursosView({ rol }: RecursosViewProps) {
  const t = useTranslations('recursos');
  const { user } = useUserStore();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [showUploader, setShowUploader] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('todos');
  const [deleteTarget, setDeleteTarget] = useState<RecursoItem | null>(null);
  const [editTarget, setEditTarget] = useState<RecursoItem | null>(null);

  const canUpload = rol === 'admin' || rol === 'profesor';

  // ── Data: resources (via RPC) ──────────────────────────────────────
  const { data: recursos = [], isLoading } = useQuery<RecursoItem[]>({
    queryKey: ['recursos', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recursos_for_user');
      if (error) throw error;
      return (data as RecursoItem[] | null) ?? [];
    },
  });

  // ── Data: alumnos list ────────────────────────────────────────────
  const { data: alumnos = [] } = useQuery<Alumno[]>({
    queryKey: ['recursos_alumnos', user?.id, rol],
    enabled: !!user && canUpload,
    staleTime: 30_000,
    queryFn: async () => {
      if (rol === 'admin') {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nombre, apellido')
          .eq('rol', 'alumno')
          .eq('activo', true)
          .order('nombre');
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from('alumnos_extra')
        .select('alumno_id, profiles!alumnos_extra_alumno_id_fkey(id, nombre, apellido)')
        .eq('profesor_id', user!.id)
        .eq('profiles.activo', true);
      if (error) throw error;
      return (data ?? []).map((r) => {
        const p = r.profiles as unknown as { id: string; nombre: string; apellido: string };
        return { id: p.id, nombre: p.nombre, apellido: p.apellido };
      });
    },
  });

  // ── Mutation: delete ──────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (recurso: RecursoItem) => {
      if (recurso.tipo === 'archivo' && recurso.storage_path) {
        const { error: storageErr } = await supabase.storage
          .from('recursos')
          .remove([recurso.storage_path]);
        if (storageErr) throw storageErr;
      }
      const { error } = await supabase
        .from('recursos_compartidos')
        .delete()
        .eq('id', recurso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('exito_eliminado'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error(t('error_eliminar'));
      setDeleteTarget(null);
    },
  });

  // ── Mutation: edit ────────────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { titulo: string; descripcion: string | null; para_todos: boolean; alumno_ids: string[]; bloquear_descarga: boolean };
    }) => {
      // Update the resource metadata
      const { error: updateErr } = await supabase
        .from('recursos_compartidos')
        .update({
          titulo: data.titulo,
          descripcion: data.descripcion,
          para_todos: data.para_todos,
          bloquear_descarga: data.bloquear_descarga,
        })
        .eq('id', id);
      if (updateErr) throw updateErr;

      // Sync acceso records:
      // 1. Remove all existing grants for this resource
      const { error: deleteErr } = await supabase
        .from('recursos_acceso')
        .delete()
        .eq('recurso_id', id);
      if (deleteErr) throw deleteErr;

      // 2. Re-insert if specific alumnos chosen
      if (!data.para_todos && data.alumno_ids.length > 0) {
        const { error: insertErr } = await supabase
          .from('recursos_acceso')
          .insert(data.alumno_ids.map((alumno_id) => ({ recurso_id: id, alumno_id })));
        if (insertErr) throw insertErr;
      }
    },
    onSuccess: (_, { id }) => {
      toast.success(t('exito_editado'));
      // Invalidate resource list and acceso records for this resource
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      queryClient.invalidateQueries({ queryKey: ['recurso-acceso', id] });
      // NOTE: we intentionally keep ['signed-url', id] cached —
      // the file itself didn't change, only metadata
      setEditTarget(null);
    },
    onError: () => {
      toast.error(t('error_editar'));
    },
  });

  // ── Download: force save-as with correct filename ─────────────────
  const handleDownload = async (recurso: RecursoItem): Promise<void> => {
    if (!recurso.storage_path) return;
    try {
      const res = await fetch(`/api/recursos/${recurso.id}/download?action=download`);
      if (!res.ok) throw new Error('Failed to get download URL');
      const { url } = await res.json();
      const a = document.createElement('a');
      a.href = url;
      a.download = recurso.titulo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error(t('error_subir'));
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────
  const filtered = activeTab === 'todos'
    ? recursos
    : recursos.filter((r) => r.tipo === activeTab);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'todos',   label: t('tab_todos') },
    { key: 'archivo', label: t('tab_archivos') },
    { key: 'enlace',  label: t('tab_enlaces') },
    { key: 'video',   label: t('tab_videos') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo')}
        actions={canUpload ? (
          <button
            onClick={() => setShowUploader((v) => !v)}
            className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-gold)] transition-all hover:opacity-90 min-h-[44px]"
          >
            {showUploader ? <X className="size-4" /> : <Plus className="size-4" />}
            {showUploader ? t('cancelar') : t('nuevo_recurso')}
          </button>
        ) : null}
      />

      {canUpload && showUploader && (
        <RecursoUploader
          alumnos={alumnos}
          onSuccess={() => {
            setShowUploader(false);
            queryClient.invalidateQueries({ queryKey: ['recursos'] });
          }}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map(({ key, label }) => {
          const count = key === 'todos' ? recursos.length : recursos.filter((r) => r.tipo === key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
                activeTab === key
                  ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  activeTab === key
                    ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading || !user ? (
        <div className="py-16 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand-gold)]" />
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">{t('cargando')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-brand-gold-muted)]">
            <FolderOpen className="size-7 text-[var(--color-brand-gold)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {rol === 'alumno' ? t('sin_recursos_alumno') : t('sin_recursos')}
            </p>
            {canUpload && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('sin_recursos_desc')}</p>
            )}
          </div>
          {canUpload && !showUploader && (
            <button
              onClick={() => setShowUploader(true)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-gold)] px-4 py-2 text-sm font-medium text-[var(--color-brand-gold)] transition-colors hover:bg-[var(--color-brand-gold-muted)]"
            >
              <Plus className="size-4" />
              {t('nuevo_recurso')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((recurso) => (
            <RecursoCard
              key={recurso.id}
              recurso={recurso}
              rol={rol}
              userId={user?.id ?? ''}
              uploaderIdMatch={recurso.subido_por === user?.id}
              onDelete={(id) => {
                const r = recursos.find((x) => x.id === id);
                if (r) setDeleteTarget(r);
              }}
              onEdit={(r) => setEditTarget(r)}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmModal
          open={!!deleteTarget}
          title={t('confirmar_eliminar')}
          description={t('confirmar_eliminar_desc')}
          confirmText={t('eliminar')}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          loading={deleteMutation.isPending}
          isDanger
        />
      )}

      {/* Edit modal */}
      {editTarget && canUpload && (
        <RecursoEditModal
          recurso={editTarget}
          alumnos={alumnos}
          saving={editMutation.isPending}
          onClose={() => setEditTarget(null)}
          onSave={async (id, data) => {
            await editMutation.mutateAsync({ id, data });
          }}
        />
      )}
    </div>
  );
}
