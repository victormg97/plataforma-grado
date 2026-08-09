'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Lightbulb } from 'lucide-react';
import { suggestTagsForText, type SuggestionSource } from '@/lib/question-bank/suggestions';
import type { QbTag } from '@/lib/supabase/types';

interface TagSelectorProps {
  tags: QbTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Content to generate suggestions from */
  contentForSuggestions?: string;
  /** Compact mode for import views */
  compact?: boolean;
}

export function TagSelector({ tags, selectedIds, onChange, contentForSuggestions, compact = false }: TagSelectorProps) {
  const t = useTranslations('bancoPreguntas');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filteredTags = search.trim()
    ? tags.filter(tag =>
        tag.name.toLowerCase().includes(search.toLowerCase()) &&
        !selectedIds.includes(tag.id)
      )
    : [];

  const showCreate = search.trim() &&
    !tags.some(t => t.name.toLowerCase() === search.trim().toLowerCase());

  // Suggestions
  const tagSources: SuggestionSource[] = useMemo(() => {
    return tags.map(t => ({ id: t.id, name: t.name, keywords: t.keywords || [] }));
  }, [tags]);

  const isContentEmpty = (html: string | undefined) => {
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, '').trim();
    return stripped.length === 0;
  };

  const suggestions = useMemo(() => {
    if (isContentEmpty(contentForSuggestions)) return [];
    return suggestTagsForText(contentForSuggestions!, tagSources, 5)
      .filter(s => !selectedIds.includes(s.id));
  }, [contentForSuggestions, tagSources, selectedIds]);

  const createTag = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/question-bank/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: async (name) => {
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(['qb-tags'], (old: QbTag[] | undefined) => [
        ...(old || []),
        { id: tempId, tenant: '', name, keywords: [], created_at: '', updated_at: '' },
      ]);
      onChange([...selectedIds, tempId]);
      setSearch('');
      setDropdownOpen(false);
      return { tempId };
    },
    onSuccess: (data, _name, context) => {
      queryClient.setQueryData(['qb-tags'], (old: QbTag[] | undefined) =>
        (old || []).map(t => t.id === context?.tempId ? data : t)
      );
      onChange(selectedIds.map(id => id === context?.tempId ? data.id : id));
    },
    onError: (_err, _name, context) => {
      queryClient.setQueryData(['qb-tags'], (old: QbTag[] | undefined) =>
        (old || []).filter(t => t.id !== context?.tempId)
      );
      onChange(selectedIds.filter(id => id !== context?.tempId));
    },
  });

  const removeTag = (tagId: string) => {
    onChange(selectedIds.filter(id => id !== tagId));
  };

  return (
    <div>
      {!compact && (
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
          {t('tags')}
        </label>
      )}
      {/* Selected tags */}
      {selectedIds.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${compact ? 'mb-1.5' : 'mb-2'}`}>
          {selectedIds.map(tagId => {
            const tag = tags.find(t => t.id === tagId);
            if (!tag) return null;
            return (
              <span
                key={tagId}
                className={`inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] font-medium text-[var(--color-brand-gold)] ${
                  compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
                }`}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => removeTag(tagId)}
                  className="hover:text-[var(--color-error)] transition-colors"
                >
                  <X className={compact ? 'size-2.5' : 'size-3'} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {/* Tag input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && search.trim() && showCreate) {
              e.preventDefault();
              createTag.mutate(search.trim());
            }
          }}
          placeholder={t('tags_placeholder')}
          className={`w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)] ${
            compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-sm'
          }`}
        />
        {dropdownOpen && search && (filteredTags.length > 0 || showCreate) && (
          <div className="absolute z-10 mt-1 w-full max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-[var(--shadow-lg)]">
            {filteredTags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange([...selectedIds, tag.id]); setSearch(''); setDropdownOpen(false); }}
                className={`w-full px-3 py-2 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors ${compact ? 'text-[11px]' : 'text-sm'}`}
              >
                {tag.name}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { createTag.mutate(search.trim()); setDropdownOpen(false); }}
                className={`w-full px-3 py-2 text-left text-[var(--color-brand-gold)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors ${compact ? 'text-[11px]' : 'text-sm'}`}
              >
                <Plus className="inline size-3.5 mr-1" />
                {t('crear_tag', { name: search.trim() })}
              </button>
            )}
          </div>
        )}
      </div>
      {/* Tag suggestions */}
      {!compact && suggestions.length > 0 && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Lightbulb className="size-3.5 text-[var(--color-brand-gold)]" />
          <span className="text-xs text-[var(--color-text-muted)]">{t('sugerencia_tags')}:</span>
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange([...selectedIds, s.id])}
              className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)] hover:bg-[color-mix(in_srgb,var(--color-brand-gold)_20%,transparent)] transition-colors"
            >
              + {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
