'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, StickyNote, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { NotaEditor } from '@/components/notas/NotaEditor';
import { NotaCard } from '@/components/notas/NotaCard';
import { useNotasClase } from '@/lib/hooks/useNotasClase';
import { useUserStore } from '@/stores/useUserStore';

type NotasSectionProps = {
  horarioId: string;
};

export function NotasSection({ horarioId }: NotasSectionProps) {
  const { user } = useUserStore();
  const searchParams = useSearchParams();
  const highlightNotaId = searchParams.get('nota_id');
  const {
    notas,
    allNotas,
    loading,
    searchTerm,
    setSearchTerm,
    crear,
    actualizar,
    eliminar,
    creando,
    actualizando,
    eliminando,
  } = useNotasClase(horarioId);

  const [showEditor, setShowEditor] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notaRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hasScrolled = useRef(false);
  const t = useTranslations('notas');

  // Scroll to highlighted note once notes are loaded
  useEffect(() => {
    if (!highlightNotaId || loading || hasScrolled.current || notas.length === 0) return;

    const el = notaRefs.current.get(highlightNotaId);
    if (el) {
      hasScrolled.current = true;
      // Small delay to ensure DOM is painted
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [highlightNotaId, loading, notas]);

  // Debounced search (300ms)
  const handleSearchChange = useCallback(
    (value: string) => {
      setDebouncedSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setSearchTerm(value), 300);
    },
    [setSearchTerm]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleCreate = async (html: string) => {
    try {
      await crear(html);
      setShowEditor(false);
      toast.success(t('nota_creada'));
    } catch {
      toast.error(t('error_crear'));
    }
  };

  const handleUpdate = async (id: string, contenido: string) => {
    try {
      await actualizar({ id, contenido });
      toast.success(t('nota_actualizada'));
    } catch {
      toast.error(t('error_actualizar'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await eliminar(id);
      toast.success(t('nota_eliminada'));
    } catch {
      toast.error(t('error_eliminar'));
    }
  };

  const setNotaRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      notaRefs.current.set(id, el);
    } else {
      notaRefs.current.delete(id);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-[var(--color-brand-gold)]" />
          <h3 className="text-sm font-semibold uppercase text-[var(--color-text-muted)]">
            {t('titulo')}
          </h3>
          {allNotas.length > 0 && (
            <span className="inline-flex items-center justify-center min-size-5 rounded-full bg-[var(--color-brand-gold-muted)] px-1.5 text-[10px] font-medium text-[var(--color-brand-gold)]">
              {allNotas.length}
            </span>
          )}
        </div>
        {!showEditor && (
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 min-h-[32px]"
          >
            <Plus className="size-3.5" />
            {t('nueva_nota')}
          </button>
        )}
      </div>

      {/* New note editor */}
      {showEditor && (
        <NotaEditor
          onSubmit={handleCreate}
          onCancel={() => setShowEditor(false)}
          loading={creando}
          submitLabel={t('guardar_nota')}
        />
      )}

      {/* Search (only show when there are notes) */}
      {allNotas.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={debouncedSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('buscar_notas')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] pl-9 pr-8 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/30"
          />
          {debouncedSearch && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="size-6 animate-spin rounded-full border-3 border-[var(--color-brand-gold)] border-t-transparent" />
        </div>
      ) : notas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <StickyNote className="size-10 text-[var(--color-text-muted)] mb-2 opacity-50" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {searchTerm ? t('sin_resultados_busqueda') : t('sin_notas')}
          </p>
          {!showEditor && !searchTerm && (
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="mt-2 text-sm text-[var(--color-brand-gold)] hover:underline"
            >
              {t('agregar_primera')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notas.map((nota) => (
            <NotaCard
              key={nota.id}
              ref={(el) => setNotaRef(nota.id, el)}
              nota={nota}
              isOwn={nota.autor_id === user?.id}
              viewerRol={user?.rol ?? 'alumno'}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              updating={actualizando}
              deleting={eliminando}
              highlight={nota.id === highlightNotaId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
