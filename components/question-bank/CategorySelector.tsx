'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Lightbulb } from 'lucide-react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { suggestTagsForText, type SuggestionSource } from '@/lib/question-bank/suggestions';
import type { QbCategory } from '@/lib/supabase/types';

interface CategorySelectorProps {
  categories: QbCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Content to generate suggestions from */
  contentForSuggestions?: string;
  /** Compact mode for import views */
  compact?: boolean;
}

export function CategorySelector({ categories, value, onChange, contentForSuggestions, compact = false }: CategorySelectorProps) {
  const t = useTranslations('bancoPreguntas');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);

  const filtered = search.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const showCreate = search.trim() &&
    !categories.some(c => c.name.toLowerCase() === search.trim().toLowerCase());

  // Suggestions
  const categorySources: SuggestionSource[] = useMemo(() => {
    return categories.map(c => ({ id: c.id, name: c.name, keywords: c.keywords || [] }));
  }, [categories]);

  const isContentEmpty = (html: string | undefined) => {
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    return stripped.length === 0;
  };

  const suggestions = useMemo(() => {
    if (isContentEmpty(contentForSuggestions)) return [];
    return suggestTagsForText(contentForSuggestions!, categorySources, 3);
  }, [contentForSuggestions, categorySources]);

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/question-bank/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: async (name) => {
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(['qb-categories'], (old: QbCategory[] | undefined) => [
        ...(old || []),
        { id: tempId, tenant: '', name, keywords: [], created_at: '', updated_at: '' },
      ]);
      onChange(tempId);
      setSearch('');
      setDropdownOpen(false);
      return { tempId };
    },
    onSuccess: (data, _name, context) => {
      queryClient.setQueryData(['qb-categories'], (old: QbCategory[] | undefined) =>
        (old || []).map(c => c.id === context?.tempId ? data : c)
      );
      onChange(data.id);
    },
    onError: (_err, _name, context) => {
      queryClient.setQueryData(['qb-categories'], (old: QbCategory[] | undefined) =>
        (old || []).filter(c => c.id !== context?.tempId)
      );
      onChange(null);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-bank/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['qb-categories'] });
      if (value === id) onChange(null);
      setDeletingItem(null);
    },
  });

  const selectedName = categories.find(c => c.id === value)?.name || '';

  return (
    <div>
      {!compact && (
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
          {t('categoria')}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={search || selectedName}
          onChange={(e) => {
            setSearch(e.target.value);
            setDropdownOpen(true);
            if (!e.target.value) onChange(null);
          }}
          onFocus={() => {
            setSearch(selectedName);
            setDropdownOpen(true);
          }}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && search.trim() && showCreate) {
              e.preventDefault();
              createCategory.mutate(search.trim());
            }
          }}
          placeholder={t('categoria_placeholder')}
          className={`w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)] ${
            compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-sm'
          }`}
        />
        {value && !dropdownOpen && (
          <button
            type="button"
            onClick={() => { onChange(null); setSearch(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
          >
            <X className={compact ? 'size-3' : 'size-3.5'} />
          </button>
        )}
        {dropdownOpen && (filtered.length > 0 || showCreate) && (
          <div className="absolute z-10 mt-1 w-full max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-[var(--shadow-lg)]">
            {filtered.map(c => (
              <div key={c.id} className="flex items-center group">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange(c.id); setSearch(''); setDropdownOpen(false); }}
                  className={`flex-1 px-3 py-2 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors ${compact ? 'text-[11px]' : 'text-sm'}`}
                >
                  {c.name}
                </button>
                {!compact && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setDropdownOpen(false); setDeletingItem({ id: c.id, name: c.name }); }}
                    className="px-2 py-2 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] transition-all"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { createCategory.mutate(search.trim()); setDropdownOpen(false); }}
                className={`w-full px-3 py-2 text-left text-[var(--color-brand-gold)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors ${compact ? 'text-[11px]' : 'text-sm'}`}
              >
                <Plus className="inline size-3.5 mr-1" />
                {t('crear_categoria', { name: search.trim() })}
              </button>
            )}
          </div>
        )}
      </div>
      {/* Suggestions */}
      {!compact && suggestions.length > 0 && !value && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Lightbulb className="size-3.5 text-[var(--color-brand-gold)]" />
          <span className="text-xs text-[var(--color-text-muted)]">{t('sugerencia_categoria')}:</span>
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange(s.id); setSearch(''); }}
              className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)] hover:bg-[color-mix(in_srgb,var(--color-brand-gold)_20%,transparent)] transition-colors"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => { if (deletingItem) deleteCategory.mutate(deletingItem.id); }}
        title={t('confirmar_eliminar_item')}
        description={`"${deletingItem?.name}" — ${t('confirmar_eliminar_item_desc')}`}
        confirmText={t('eliminar')}
        loading={deleteCategory.isPending}
      />
    </div>
  );
}
