'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, FolderOpen, X, FolderPlus, ChevronRight, Home } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { RecursoCard, type RecursoItem } from '@/components/recursos/RecursoCard';
import { CarpetaCard, type CarpetaItem } from '@/components/recursos/CarpetaCard';
import { CarpetaModal } from '@/components/recursos/CarpetaModal';
import { CarpetaPermisosModal } from '@/components/recursos/CarpetaPermisosModal';
import { MoverRecursoModal } from '@/components/recursos/MoverRecursoModal';
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

interface RpcResult {
  recursos: RecursoItem[];
  carpetas: CarpetaItem[];
}

export function RecursosView({ rol }: RecursosViewProps) {
  const t = useTranslations('recursos');
  const { user } = useUserStore();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [showUploader, setShowUploader] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('todos');
  const [deleteTarget, setDeleteTarget] = useState<RecursoItem | null>(null);
  const [editTarget, setEditTarget] = useState<RecursoItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<RecursoItem | null>(null);

  // Folder navigation state
  const [currentCarpetaId, setCurrentCarpetaId] = useState<string | null>(null);
  const [carpetaModalMode, setCarpetaModalMode] = useState<'create' | 'rename' | null>(null);
  const [renamingCarpeta, setRenamingCarpeta] = useState<CarpetaItem | null>(null);
  const [deleteCarpetaTarget, setDeleteCarpetaTarget] = useState<CarpetaItem | null>(null);
  const [editPermisosCarpeta, setEditPermisosCarpeta] = useState<CarpetaItem | null>(null);

  const canUpload = rol === 'admin' || rol === 'profesor';

  // ── Data: resources + folders (via RPC) ───────────────────────────
  const { data: rpcData, isLoading } = useQuery<RpcResult>({
    queryKey: ['recursos', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_recursos_for_user');
      if (error) throw error;
      const result = data as RpcResult | null;
      return {
        recursos: result?.recursos ?? [],
        carpetas: result?.carpetas ?? [],
      };
    },
  });

  const allRecursos: RecursoItem[] = rpcData?.recursos ?? [];
  const allCarpetas: CarpetaItem[] = rpcData?.carpetas ?? [];

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

  // ── Derived: current folder view ──────────────────────────────────
  // Carpetas at current level
  const currentCarpetas = useMemo(
    () => allCarpetas.filter((c) => c.parent_id === currentCarpetaId),
    [allCarpetas, currentCarpetaId]
  );

  // Resources in current folder
  const currentRecursos = useMemo(
    () => allRecursos.filter((r) => (r.carpeta_id ?? null) === currentCarpetaId),
    [allRecursos, currentCarpetaId]
  );

  // Enrich carpetas with resource count
  const carpetasWithCount = useMemo(
    () => currentCarpetas.map((c) => ({
      ...c,
      recursos_count: allRecursos.filter((r) => r.carpeta_id === c.id).length,
    })),
    [currentCarpetas, allRecursos]
  );

  // Breadcrumb path
  const breadcrumb = useMemo(() => {
    if (!currentCarpetaId) return [];
    const path: CarpetaItem[] = [];
    let id: string | null = currentCarpetaId;
    while (id) {
      const c = allCarpetas.find((x) => x.id === id);
      if (!c) break;
      path.unshift(c);
      id = c.parent_id;
    }
    return path;
  }, [currentCarpetaId, allCarpetas]);

  // Tab filter applied to current folder's resources
  const filteredRecursos = useMemo(
    () => activeTab === 'todos' ? currentRecursos : currentRecursos.filter((r) => r.tipo === activeTab),
    [currentRecursos, activeTab]
  );

  // ── Mutation: delete resource ─────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (recurso: RecursoItem) => {
      if (recurso.tipo === 'archivo' && recurso.storage_path) {
        await supabase.storage.from('recursos').remove([recurso.storage_path]);
      }
      const { error } = await supabase.from('recursos_compartidos').delete().eq('id', recurso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('exito_eliminado'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      setDeleteTarget(null);
    },
    onError: () => { toast.error(t('error_eliminar')); setDeleteTarget(null); },
  });

  // ── Mutation: edit resource ───────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { titulo: string; descripcion: string | null; para_todos: boolean; alumno_ids: string[]; bloquear_descarga: boolean };
    }) => {
      const { error: updateErr } = await supabase
        .from('recursos_compartidos')
        .update({ titulo: data.titulo, descripcion: data.descripcion, para_todos: data.para_todos, bloquear_descarga: data.bloquear_descarga })
        .eq('id', id);
      if (updateErr) throw updateErr;
      await supabase.from('recursos_acceso').delete().eq('recurso_id', id);
      if (!data.para_todos && data.alumno_ids.length > 0) {
        const { error: insertErr } = await supabase
          .from('recursos_acceso')
          .insert(data.alumno_ids.map((alumno_id) => ({ recurso_id: id, alumno_id })));
        if (insertErr) throw insertErr;
      }
    },
    onSuccess: (_, { id }) => {
      toast.success(t('exito_editado'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      queryClient.invalidateQueries({ queryKey: ['recurso-acceso', id] });
      setEditTarget(null);
    },
    onError: () => toast.error(t('error_editar')),
  });

  // ── Mutation: move resource to folder ─────────────────────────────
  const moveMutation = useMutation({
    mutationFn: async ({ id, carpetaId }: { id: string; carpetaId: string | null }) => {
      const { error } = await supabase
        .from('recursos_compartidos')
        .update({ carpeta_id: carpetaId })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('exito_movido'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      setMoveTarget(null);
    },
    onError: () => toast.error(t('error_mover')),
  });

  // ── Mutation: create folder ───────────────────────────────────────
  const createCarpetaMutation = useMutation({
    mutationFn: async (nombre: string) => {
      const { error } = await supabase
        .from('carpetas_recursos')
        .insert({ nombre, parent_id: currentCarpetaId, creada_por: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('carpeta_creada'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      setCarpetaModalMode(null);
    },
    onError: () => toast.error(t('error_crear_carpeta')),
  });

  // ── Mutation: rename folder ───────────────────────────────────────
  const renameCarpetaMutation = useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) => {
      const { error } = await supabase
        .from('carpetas_recursos')
        .update({ nombre })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('carpeta_renombrada'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      setCarpetaModalMode(null);
      setRenamingCarpeta(null);
    },
    onError: () => toast.error(t('error_renombrar_carpeta')),
  });

  // ── Mutation: delete folder ───────────────────────────────────────
  const deleteCarpetaMutation = useMutation({
    mutationFn: async (id: string) => {
      // Move all resources in this folder to root first
      await supabase
        .from('recursos_compartidos')
        .update({ carpeta_id: null })
        .eq('carpeta_id', id);
      const { error } = await supabase.from('carpetas_recursos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('carpeta_eliminada'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      setDeleteCarpetaTarget(null);
    },
    onError: () => toast.error(t('error_eliminar_carpeta')),
  });

  // ── Mutation: propagate folder permissions to all resources inside ──
  const propagarPermisosMutation = useMutation({
    mutationFn: async ({
      carpetaId,
      para_todos,
      alumno_ids,
    }: {
      carpetaId: string;
      para_todos: boolean;
      alumno_ids: string[];
    }) => {
      // 1. Get all resource IDs in this folder
      const { data: recursos, error: fetchErr } = await supabase
        .from('recursos_compartidos')
        .select('id')
        .eq('carpeta_id', carpetaId);
      if (fetchErr) throw fetchErr;
      if (!recursos || recursos.length === 0) return;

      const ids = recursos.map((r) => r.id);

      // 2. Update para_todos on all resources
      const { error: updateErr } = await supabase
        .from('recursos_compartidos')
        .update({ para_todos })
        .in('id', ids);
      if (updateErr) throw updateErr;

      // 3. Delete all existing acceso records for these resources
      const { error: deleteErr } = await supabase
        .from('recursos_acceso')
        .delete()
        .in('recurso_id', ids);
      if (deleteErr) throw deleteErr;

      // 4. Re-insert acceso records if specific alumnos chosen
      if (!para_todos && alumno_ids.length > 0) {
        const rows = ids.flatMap((recurso_id) =>
          alumno_ids.map((alumno_id) => ({ recurso_id, alumno_id }))
        );
        const { error: insertErr } = await supabase
          .from('recursos_acceso')
          .insert(rows);
        if (insertErr) throw insertErr;
      }
    },
    onSuccess: () => {
      toast.success(t('carpeta_permisos_guardados'));
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      setEditPermisosCarpeta(null);
    },
    onError: () => toast.error(t('error_guardar_permisos_carpeta')),
  });

  // ── Download ──────────────────────────────────────────────────────
  const handleDownload = async (recurso: RecursoItem): Promise<void> => {
    if (!recurso.storage_path) return;
    try {
      const res = await fetch(`/api/recursos/${recurso.id}/download?action=download`);
      if (!res.ok) throw new Error();
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

  // ── Tab counts (for current folder) ──────────────────────────────
  const TABS: { key: Tab; label: string }[] = [
    { key: 'todos',   label: t('tab_todos') },
    { key: 'archivo', label: t('tab_archivos') },
    { key: 'enlace',  label: t('tab_enlaces') },
    { key: 'video',   label: t('tab_videos') },
  ];

  const isEmpty = carpetasWithCount.length === 0 && filteredRecursos.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo')}
        actions={canUpload ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCarpetaModalMode('create'); setRenamingCarpeta(null); }}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--color-bg-secondary)] min-h-[44px]"
            >
              <FolderPlus className="size-4" />
              {t('nueva_carpeta')}
            </button>
            <button
              onClick={() => setShowUploader((v) => !v)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-gold)] transition-all hover:opacity-90 min-h-[44px]"
            >
              {showUploader ? <X className="size-4" /> : <Plus className="size-4" />}
              {showUploader ? t('cancelar') : t('nuevo_recurso')}
            </button>
          </div>
        ) : null}
      />

      {canUpload && showUploader && (
        <RecursoUploader
          alumnos={alumnos}
          defaultCarpetaId={currentCarpetaId}
          onSuccess={() => {
            setShowUploader(false);
            queryClient.invalidateQueries({ queryKey: ['recursos'] });
          }}
        />
      )}

      {/* Breadcrumb navigation */}
      {(breadcrumb.length > 0 || currentCarpetaId) && (
        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => setCurrentCarpetaId(null)}
            className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Home className="size-3.5" />
            {t('titulo')}
          </button>
          {breadcrumb.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 text-[var(--color-text-muted)]" />
              <button
                onClick={() => setCurrentCarpetaId(c.id)}
                className={cn(
                  'transition-colors',
                  c.id === currentCarpetaId
                    ? 'font-semibold text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                )}
              >
                {c.nombre}
              </button>
            </span>
          ))}
        </nav>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map(({ key, label }) => {
          const count = key === 'todos' ? currentRecursos.length : currentRecursos.filter((r) => r.tipo === key).length;
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
      ) : isEmpty && activeTab === 'todos' ? (
        <div className="flex flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-brand-gold-muted)]">
            <FolderOpen className="size-7 text-[var(--color-brand-gold)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {currentCarpetaId ? t('carpeta_vacia') : (rol === 'alumno' ? t('sin_recursos_alumno') : t('sin_recursos'))}
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
        <div className="space-y-4">
          {/* Folders grid — only shown in "todos" tab */}
          {activeTab === 'todos' && carpetasWithCount.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {carpetasWithCount.map((c) => (
                <CarpetaCard
                  key={c.id}
                  carpeta={c}
                  canManage={canUpload && (rol === 'admin' || c.creada_por === user?.id)}
                  onClick={() => setCurrentCarpetaId(c.id)}
                  onRename={(carpeta) => { setRenamingCarpeta(carpeta); setCarpetaModalMode('rename'); }}
                  onDelete={(carpeta) => setDeleteCarpetaTarget(carpeta)}
                  onEditPermisos={(carpeta) => setEditPermisosCarpeta(carpeta)}
                />
              ))}
            </div>
          )}

          {/* Resources grid */}
          {filteredRecursos.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredRecursos.map((recurso) => (
                <RecursoCard
                  key={recurso.id}
                  recurso={recurso}
                  rol={rol}
                  userId={user?.id ?? ''}
                  uploaderIdMatch={recurso.subido_por === user?.id}
                  onDelete={(id) => {
                    const r = allRecursos.find((x) => x.id === id);
                    if (r) setDeleteTarget(r);
                  }}
                  onEdit={(r) => setEditTarget(r)}
                  onDownload={handleDownload}
                  onMove={canUpload ? (r) => setMoveTarget(r) : undefined}
                />
              ))}
            </div>
          )}

          {/* Empty filtered state */}
          {filteredRecursos.length === 0 && activeTab !== 'todos' && (
            <div className="py-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">{t('sin_recursos_filtro')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Create / rename folder */}
      {carpetaModalMode && (
        <CarpetaModal
          initialNombre={carpetaModalMode === 'rename' ? renamingCarpeta?.nombre : undefined}
          saving={createCarpetaMutation.isPending || renameCarpetaMutation.isPending}
          onClose={() => { setCarpetaModalMode(null); setRenamingCarpeta(null); }}
          onSave={async (nombre) => {
            if (carpetaModalMode === 'rename' && renamingCarpeta) {
              await renameCarpetaMutation.mutateAsync({ id: renamingCarpeta.id, nombre });
            } else {
              await createCarpetaMutation.mutateAsync(nombre);
            }
          }}
        />
      )}

      {/* Delete folder confirm */}
      {deleteCarpetaTarget && (
        <ConfirmModal
          open
          title={t('confirmar_eliminar_carpeta')}
          description={t('confirmar_eliminar_carpeta_desc', { nombre: deleteCarpetaTarget.nombre })}
          confirmText={t('eliminar_carpeta')}
          onConfirm={() => deleteCarpetaMutation.mutate(deleteCarpetaTarget.id)}
          onClose={() => setDeleteCarpetaTarget(null)}
          loading={deleteCarpetaMutation.isPending}
          isDanger
        />
      )}

      {/* Move resource */}
      {moveTarget && (
        <MoverRecursoModal
          recurso={moveTarget}
          carpetas={allCarpetas.filter((c) => rol === 'admin' || c.creada_por === user?.id)}
          moving={moveMutation.isPending}
          onClose={() => setMoveTarget(null)}
          onMove={async (carpetaId) => {
            await moveMutation.mutateAsync({ id: moveTarget.id, carpetaId });
          }}
        />
      )}

      {/* Delete resource confirm */}
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

      {/* Edit resource modal */}
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

      {/* Edit folder permissions */}
      {editPermisosCarpeta && canUpload && (
        <CarpetaPermisosModal
          carpeta={editPermisosCarpeta}
          recursosEnCarpeta={allRecursos.filter((r) => r.carpeta_id === editPermisosCarpeta.id)}
          alumnos={alumnos}
          saving={propagarPermisosMutation.isPending}
          onClose={() => setEditPermisosCarpeta(null)}
          onSave={async ({ para_todos, alumno_ids }) => {
            await propagarPermisosMutation.mutateAsync({
              carpetaId: editPermisosCarpeta.id,
              para_todos,
              alumno_ids,
            });
          }}
        />
      )}
    </div>
  );
}
