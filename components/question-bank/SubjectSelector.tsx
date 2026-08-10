'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import type { QbSubject } from '@/lib/supabase/types';

interface SubjectSelectorProps {
  subjects: QbSubject[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Compact mode for import views */
  compact?: boolean;
}

export function SubjectSelector({ subjects, value, onChange, compact = false }: SubjectSelectorProps) {
  const t = useTranslations('bancoPreguntas');
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ id: string; name: string } | null>(null);

  const filtered = search.trim()
    ? subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : subjects;

  const showCreate = search.trim() &&
    !subjects.some(s => s.name.toLowerCase() === search.trim().toLowerCase());

  const createSubject = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/question-bank/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onMutate: async (name) => {
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData(['qb-subjects'], (old: QbSubject[] | undefined) => [
        ...(old || []),
        { id: tempId, tenant: '', name, keywords: [], created_at: '', updated_at: '' },
      ]);
      onChange(tempId);
      setSearch('');
      setDropdownOpen(false);
      return { tempId };
    },
    onSuccess: (data, _name, context) => {
      queryClient.setQueryData(['qb-subjects'], (old: QbSubject[] | undefined) =>
        (old || []).map(s => s.id === context?.tempId ? data : s)
      );
      onChange(data.id);
    },
    onError: (_err, _name, context) => {
      queryClient.setQueryData(['qb-subjects'], (old: QbSubject[] | undefined) =>
        (old || []).filter(s => s.id !== context?.tempId)
      );
      onChange(null);
    },
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-bank/subjects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['qb-subjects'] });
      if (value === id) onChange(null);
      setDeletingItem(null);
    },
  });

  const selectedName = subjects.find(s => s.id === value)?.name || '';

  return (
    <div>
      {!compact && (
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
          {t('materia')}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          autoComplete="off"
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
              createSubject.mutate(search.trim());
            }
          }}
          placeholder={t('materia_placeholder')}
          className={`w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] outline-none transition-colors focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)] ${
            compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-sm'
          } ${value ? (compact ? 'pr-6' : 'pr-7') : ''}`}
        />
        {/* Clear button — always visible when value is set */}
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setSearch(''); setDropdownOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
          >
            <X className={compact ? 'size-3' : 'size-3.5'} />
          </button>
        )}
        {dropdownOpen && (filtered.length > 0 || showCreate) && (
          <div className="absolute z-10 mt-1 w-full max-h-[200px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-[var(--shadow-lg)]">
            {filtered.map(s => (
              <div key={s.id} className="flex items-center group">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange(s.id); setSearch(''); setDropdownOpen(false); }}
                  className={`flex-1 px-3 py-2 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors ${compact ? 'text-[11px]' : 'text-sm'}`}
                >
                  {s.name}
                </button>
                {!compact && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setDropdownOpen(false); setDeletingItem({ id: s.id, name: s.name }); }}
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
                onClick={() => createSubject.mutate(search.trim())}
                className={`w-full px-3 py-2 text-left text-[var(--color-brand-gold)] font-medium hover:bg-[var(--color-bg-secondary)] transition-colors ${compact ? 'text-[11px]' : 'text-sm'}`}
              >
                <Plus className="inline size-3.5 mr-1" />
                {t('crear_materia', { name: search.trim() })}
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => { if (deletingItem) deleteSubject.mutate(deletingItem.id); }}
        title={t('confirmar_eliminar_item')}
        description={`"${deletingItem?.name}" — ${t('confirmar_eliminar_item_desc')}`}
        confirmText={t('eliminar')}
        loading={deleteSubject.isPending}
      />
    </div>
  );
}
