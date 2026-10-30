'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Layers, Link2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useManageQuizCatalog, useQbCategories } from '@/lib/hooks/useComunidadAdmin';
import type { AdminQuizSubjectConfig, QuizCatalogPayload } from '@/lib/comunidad/quiz-display';

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none';

/** Maps catalog error codes to messages. */
function useCatalogError() {
  const t = useTranslations('comunidadEstrategica');
  return (e: unknown) => {
    const err = e as { message?: string; payload?: { count?: number } };
    switch (err?.message) {
      case 'DUPLICATE':
        return t('quizcfg_err_duplicate');
      case 'HAS_QUESTIONS':
        return t('quizcfg_err_has_questions', { count: err.payload?.count ?? 0 });
      case 'NAME_REQUIRED':
        return t('quizcfg_err_name_required');
      case 'NAME_TOO_LONG':
        return t('quizcfg_err_name_long');
      default:
        return t('admin_error');
    }
  };
}

/** Create or rename a subject / rename a category. */
export function CatalogNameDialog({
  title,
  label,
  initial = '',
  submitLabel,
  buildPayload,
  hint,
  onDone,
  onClose,
}: {
  title: string;
  label: string;
  initial?: string;
  submitLabel: string;
  buildPayload: (name: string) => QuizCatalogPayload;
  hint?: string;
  onDone?: (id: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const manage = useManageQuizCatalog();
  const toMessage = useCatalogError();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchanged = trimmed === initial.trim();

  const submit = async () => {
    if (!trimmed || unchanged) return;
    setError(null);
    try {
      const res = await manage.mutateAsync(buildPayload(trimmed));
      toast.success(t('admin_saved'));
      onDone?.(res.id);
      onClose();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('admin_cancel')}</Button>
          <Button onClick={submit} loading={manage.isPending} disabled={!trimmed || unchanged}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
          <input
            autoFocus
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        {hint && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>}
        {error && <p className="text-xs text-[var(--color-error)]" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

/**
 * Add a category to a subject: pick an existing bank category (suggestions
 * filter as you type) or create a new one with the typed name.
 */
export function AddCategoryDialog({
  subject,
  onClose,
}: {
  subject: AdminQuizSubjectConfig;
  onClose: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const manage = useManageQuizCatalog();
  const toMessage = useCatalogError();
  const { data: bank = [], isLoading } = useQbCategories();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const linked = useMemo(() => new Set(subject.categories.map((c) => c.id)), [subject.categories]);
  const q = query.trim().toLowerCase();
  const suggestions = useMemo(
    () =>
      bank
        .filter((c) => !linked.has(c.id) && (!q || c.name.toLowerCase().includes(q)))
        .slice(0, 8),
    [bank, linked, q]
  );
  const exact = bank.find((c) => c.name.toLowerCase() === q);
  const exactLinked = exact ? linked.has(exact.id) : false;

  const add = async (payload: QuizCatalogPayload) => {
    setError(null);
    try {
      await manage.mutateAsync(payload);
      toast.success(t('quizcfg_category_added'));
      onClose();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('quizcfg_add_category_title', { subject: subject.name })}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={query}
          maxLength={120}
          placeholder={t('quizcfg_add_category_placeholder')}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
        />

        {q && !exact && (
          <button
            type="button"
            disabled={manage.isPending}
            onClick={() => add({ action: 'add_category', subject_id: subject.id, name: query.trim() })}
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-brand-gold)] px-3 py-2.5 text-left text-sm font-medium text-[var(--color-brand-gold)] transition-colors hover:bg-[var(--color-brand-gold-muted)] disabled:opacity-50"
          >
            <Plus className="size-4 shrink-0" />
            {t('quizcfg_create_category', { name: query.trim() })}
          </button>
        )}
        {exactLinked && (
          <p className="text-xs text-[var(--color-text-muted)]">{t('quizcfg_category_already')}</p>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('quizcfg_existing_categories')}
          </span>
          {isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('admin_loading')}</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('quizcfg_no_suggestions')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={manage.isPending}
                    onClick={() => add({ action: 'add_category', subject_id: subject.id, category_id: c.id })}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50'
                    )}
                  >
                    <Layers className="size-4 shrink-0 text-[var(--color-text-muted)]" />
                    <span className="flex-1 truncate">{c.name}</span>
                    <Link2 className="size-4 shrink-0 text-[var(--color-brand-gold)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-[var(--color-text-muted)]">{t('quizcfg_add_category_hint')}</p>
        {error && <p className="text-xs text-[var(--color-error)]" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/** Confirmation for deleting a subject / removing a category. */
export function CatalogDeleteDialog({
  title,
  description,
  payload,
  onClose,
}: {
  title: string;
  description: string;
  payload: QuizCatalogPayload;
  onClose: () => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const manage = useManageQuizCatalog();
  const toMessage = useCatalogError();

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={title}
      description={description}
      confirmText={t('quizcfg_delete_confirm')}
      cancelText={t('admin_cancel')}
      loading={manage.isPending}
      onConfirm={async () => {
        try {
          await manage.mutateAsync(payload);
          toast.success(t('admin_saved'));
          onClose();
        } catch (e) {
          toast.error(toMessage(e));
        }
      }}
    />
  );
}
