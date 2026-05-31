'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, FolderOpen, X, FolderPlus, ChevronRight, Home, ArrowLeft, Check, Search } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { downloadRecurso } from '@/lib/utils/downloadRecurso';
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

type SortBy = 'created_at_desc' | 'created_at_asc' | 'nombre_asc' | 'nombre_desc' | 'tipo_asc';

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

  // Sort state
  const [sortBy, setSortBy] = useState<SortBy>('created_at_desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Search state (local, in-memory across all folders)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debounce the search input for performance with large datasets
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput.trim()), 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const isSearching = searchQuery.length > 0;

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

  const allRecursos: RecursoItem[] = useMemo(() => rpcData?.recursos ?? [], [rpcData]);
  const allCarpetas: CarpetaItem[] = useMemo(() => rpcData?.carpetas ?? [], [rpcData]);

  // ── Data: sort preference (from DB) ──────────────────────────────
  const { data: sortPref } = useQuery<SortBy>({
    queryKey: ['recursos_sort_pref', user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from('user_recursos_preferences')
          .select('sort_by')
          .eq('user_id', user!.id)
          .maybeSingle();
        return (data?.sort_by as SortBy) ?? 'created_at_desc';
      } catch {
        return 'created_at_desc';
      }
    },
  });

  // Sync DB preference into local state once loaded
  useEffect(() => {
    if (sortPref) setSortBy(sortPref);
  }, [sortPref]);

  // Close sort menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

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

  // Enrich carpetas with resource count and apply sort
  const carpetasWithCount = useMemo(() => {
    const enriched = currentCarpetas.map((c) => ({
      ...c,
      recursos_count: allRecursos.filter((r) => r.carpeta_id === c.id).length,
    }));
    return [...enriched].sort((a, b) => {
      switch (sortBy) {
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_at_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'nombre_desc':
          return b.nombre.localeCompare(a.nombre, 'es');
        case 'tipo_asc':
          // folders have no tipo, fall back to name
          return a.nombre.localeCompare(b.nombre, 'es');
        case 'nombre_asc':
        default:
          return a.nombre.localeCompare(b.nombre, 'es');
      }
    });
  }, [currentCarpetas, allRecursos, sortBy]);

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

  // Parent folder id for back navigation
  const parentCarpetaId = useMemo(() => {
    if (!currentCarpetaId) return null;
    const current = allCarpetas.find((c) => c.id === currentCarpetaId);
    return current?.parent_id ?? null;
  }, [currentCarpetaId, allCarpetas]);

  // Sort + tab filter applied to current folder's resources
  const filteredRecursos = useMemo(() => {
    const filtered = activeTab === 'todos' ? currentRecursos : currentRecursos.filter((r) => r.tipo === activeTab);
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'nombre_asc':
          return a.titulo.localeCompare(b.titulo, 'es');
        case 'nombre_desc':
          return b.titulo.localeCompare(a.titulo, 'es');
        case 'tipo_asc':
          return a.tipo.localeCompare(b.tipo, 'es');
        case 'created_at_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [currentRecursos, activeTab, sortBy]);

  // ── Search results (across ALL folders, files only) ──────────────
  // When searching, ignore folder navigation and folder cards — search every
  // resource the user already has loaded in memory, filtered by title.
  // searchBase = all title matches (used for tab counts); searchResults adds
  // the active tab filter + current sort order.
  const searchBase = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    return allRecursos.filter((r) => r.titulo.toLowerCase().includes(q));
  }, [isSearching, searchQuery, allRecursos]);

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const matched = activeTab === 'todos' ? searchBase : searchBase.filter((r) => r.tipo === activeTab);
    return [...matched].sort((a, b) => {
      switch (sortBy) {
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'nombre_asc':
          return a.titulo.localeCompare(b.titulo, 'es');
        case 'nombre_desc':
          return b.titulo.localeCompare(a.titulo, 'es');
        case 'tipo_asc':
          return a.tipo.localeCompare(b.tipo, 'es');
        case 'created_at_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [isSearching, searchBase, activeTab, sortBy]);

  // ── Mutation: save sort preference ───────────────────────────────
  const saveSortPrefMutation = useMutation({
    mutationFn: async (newSort: SortBy) => {
      // Silently ignore if table doesn't exist in this tenant's DB
      try {
        const { error } = await supabase
          .from('user_recursos_preferences')
          .upsert({ user_id: user!.id, sort_by: newSort, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
      } catch {
        // Non-critical — sort preference just won't persist
      }
    },
    onSuccess: (_, newSort) => {
      queryClient.setQueryData(['recursos_sort_pref', user?.id], newSort);
    },
  });

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    setShowSortMenu(false);
    saveSortPrefMutation.mutate(newSort);
  };

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
      data: { titulo: string; descripcion: string | null; para_todos: boolean; para_todos_app: boolean; alumno_ids: string[]; bloquear_descarga: boolean };
    }) => {
      const { error: updateErr } = await supabase
        .from('recursos_compartidos')
        .update({ titulo: data.titulo, descripcion: data.descripcion, para_todos: data.para_todos, para_todos_app: data.para_todos_app, bloquear_descarga: data.bloquear_descarga })
        .eq('id', id);
      if (updateErr) throw updateErr;
      await supabase.from('recursos_acceso').delete().eq('recurso_id', id);
      if (!data.para_todos && !data.para_todos_app && data.alumno_ids.length > 0) {
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

  // ── Mutation: propagate folder permissions recursively (all subfolders) ──
  const propagarPermisosMutation = useMutation({
    mutationFn: async ({
      carpetaId,
      para_todos,
      para_todos_app,
      alumno_ids,
    }: {
      carpetaId: string;
      para_todos: boolean;
      para_todos_app: boolean;
      alumno_ids: string[];
    }) => {
      const { error } = await supabase.rpc('propagate_folder_permissions', {
        p_folder_id:      carpetaId,
        p_para_todos:     para_todos,
        p_para_todos_app: para_todos_app,
        p_alumno_ids:     alumno_ids,
      });
      if (error) throw error;
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
      await downloadRecurso(recurso.id);
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

  // No files uploaded at all (across every folder) — disables the search box
  const hasAnyRecurso = allRecursos.length > 0;

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
          rol={rol as 'admin' | 'profesor'}
          onSuccess={() => {
            setShowUploader(false);
            queryClient.invalidateQueries({ queryKey: ['recursos'] });
          }}
        />
      )}

      {/* Breadcrumb navigation — hidden while searching */}
      {!isSearching && (breadcrumb.length > 0 || currentCarpetaId) && (
        <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs sm:text-sm">
          <button
            onClick={() => setCurrentCarpetaId(null)}
            className="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Home className="size-3.5 shrink-0" />
            {t('titulo')}
          </button>
          {breadcrumb.map((c) => (
            <span key={c.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />
              <button
                onClick={() => setCurrentCarpetaId(c.id)}
                className={cn(
                  'truncate transition-colors',
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

      {/* Action bar: back arrow + search (center) + sort button */}
      <div className="flex items-center gap-2">
        {/* Back arrow — only shown when inside a folder and not searching */}
        {currentCarpetaId && !isSearching && (
          <Tooltip content={t('volver_carpeta')} position="bottom">
            <button
              type="button"
              onClick={() => setCurrentCarpetaId(parentCarpetaId)}
              className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <ArrowLeft className="size-4" />
            </button>
          </Tooltip>
        )}

        {/* Search box — centered, filters all files locally */}
        <div className="flex flex-1 justify-center">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              disabled={!hasAnyRecurso}
              placeholder={t('buscar_placeholder')}
              aria-label={t('buscar_placeholder')}
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-9 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-sm)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            {searchInput && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Tooltip content={t('buscar_limpiar')} position="bottom">
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="flex size-6 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                    aria-label={t('buscar_limpiar')}
                  >
                    <X className="size-3.5" />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* Sort button */}
        <div className="relative shrink-0" ref={sortMenuRef}>
          <Tooltip content={t('ordenar')} position="bottom">
            <button
              type="button"
              onClick={() => setShowSortMenu((v) => !v)}
              className={cn(
                'flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium shadow-[var(--shadow-sm)] transition-all min-h-[36px]',
                showSortMenu
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
              )}
            >
              {/* Classic funnel/filter icon with 3 horizontal lines of decreasing width */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="hidden sm:inline">{t('ordenar')}</span>
            </button>
          </Tooltip>

          {showSortMenu && (
            <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[200px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-[var(--shadow-lg)]">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {t('ordenar_por')}
              </p>
              {(
                [
                  { value: 'created_at_desc', label: t('sort_reciente') },
                  { value: 'created_at_asc',  label: t('sort_antiguo') },
                  { value: 'nombre_asc',       label: t('sort_nombre_az') },
                  { value: 'nombre_desc',      label: t('sort_nombre_za') },
                  { value: 'tipo_asc',         label: t('sort_tipo') },
                ] as { value: SortBy; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSortChange(value)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
                    sortBy === value
                      ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {sortBy === value && <Check className="size-3.5" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {TABS.map(({ key, label }) => {
          const source = isSearching ? searchBase : currentRecursos;
          const count = key === 'todos' ? source.length : source.filter((r) => r.tipo === key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
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
      ) : isSearching ? (
        /* ── Search mode: files only, across all folders ── */
        searchResults.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {searchResults.map((recurso) => (
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
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-16 px-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-brand-gold-muted)]">
              <Search className="size-7 text-[var(--color-brand-gold)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t('buscar_sin_resultados', { query: searchQuery })}
            </p>
            <button
              onClick={clearSearch}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-gold)] px-4 py-2 text-sm font-medium text-[var(--color-brand-gold)] transition-colors hover:bg-[var(--color-brand-gold-muted)]"
            >
              <X className="size-4" />
              {t('buscar_limpiar')}
            </button>
          </div>
        )
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
                  showPermisoBadge={rol !== 'alumno'}
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
          recursosCount={
            // Prefer recursive count from RPC; fall back to client-side recursive count
            editPermisosCarpeta.recursive_recursos_count != null
              ? Number(editPermisosCarpeta.recursive_recursos_count)
              : (() => {
                  // Build full subtree of folder IDs client-side
                  const getAllSubfolderIds = (parentId: string): string[] => {
                    const children = allCarpetas.filter((c) => c.parent_id === parentId);
                    return [parentId, ...children.flatMap((c) => getAllSubfolderIds(c.id))];
                  };
                  const ids = getAllSubfolderIds(editPermisosCarpeta.id);
                  return allRecursos.filter((r) => r.carpeta_id != null && ids.includes(r.carpeta_id)).length;
                })()
          }
          alumnos={alumnos}
          saving={propagarPermisosMutation.isPending}
          onClose={() => setEditPermisosCarpeta(null)}
          onSave={async ({ para_todos, para_todos_app, alumno_ids }) => {
            await propagarPermisosMutation.mutateAsync({
              carpetaId: editPermisosCarpeta.id,
              para_todos,
              para_todos_app,
              alumno_ids,
            });
          }}
        />
      )}
    </div>
  );
}
