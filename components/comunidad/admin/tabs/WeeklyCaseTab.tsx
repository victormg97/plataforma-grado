'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';
import { Plus, Pencil, Trash2, BookCheck, Scale } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { useAdminWeeklyCases, useDeleteWeeklyCase } from '@/lib/hooks/useComunidadAdmin';
import type { GameWeeklyCase } from '@/lib/supabase/types';
import type { WeeklyCaseStatus } from '@/lib/comunidad/weekly-case';
import { WeeklyCaseFormModal } from '../weekly-case/WeeklyCaseFormModal';
import { ResolutionModal } from '../weekly-case/ResolutionModal';
import { ConfigCallout, ConfigListHeader, ConfigEmptyState } from '../ui';

/**
 * Effective status for display/gating. The DB may still hold 'open' for a case
 * whose window has elapsed until a read persists 'closed'; mirror the SQL
 * derivation so the admin sees the real state and can publish the resolution.
 */
function effectiveStatus(c: GameWeeklyCase): WeeklyCaseStatus {
  if (c.status === 'draft' || c.status === 'resolved') return c.status;
  const now = Date.now();
  if (now < new Date(c.window_start).getTime()) return c.status;
  if (now < new Date(c.window_end).getTime()) return 'open';
  return 'closed';
}

/** Weekly case CRUD + resolution publishing (Slice 4). */
export function WeeklyCaseTab() {
  const t = useTranslations('comunidadEstrategica');
  const locale = useLocale();
  const dfLocale = locale === 'en' ? enUS : esLocale;
  const { data: cases, isLoading } = useAdminWeeklyCases();
  const del = useDeleteWeeklyCase();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GameWeeklyCase | null>(null);
  const [resolving, setResolving] = useState<GameWeeklyCase | null>(null);
  const [deleting, setDeleting] = useState<GameWeeklyCase | null>(null);

  const fmt = (iso: string) => format(new Date(iso), 'PP', { locale: dfLocale });

  const onDelete = async () => {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success(t('admin_deleted'));
    } catch {
      toast.error(t('admin_error'));
    }
    setDeleting(null);
  };

  const createButton = (
    <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
      {t('weekly_case_create')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('weekly_case_intro_title')}>{t('weekly_case_intro_desc')}</ConfigCallout>

      <ConfigListHeader
        icon={<Scale className="size-4" />}
        title={t('weekly_case_list_title')}
        description={t('weekly_case_list_desc')}
        count={(cases ?? []).length}
        action={createButton}
      />

      {isLoading ? (
        <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>
      ) : (cases ?? []).length === 0 ? (
        <ConfigEmptyState
          icon={<Scale className="size-8" />}
          message={t('weekly_case_empty_admin')}
          action={createButton}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(cases ?? []).map((c) => {
            const eff = effectiveStatus(c);
            return (
              <Card key={c.id} padding="lg" className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-text-primary)]">{c.title}</span>
                    <span className="rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-brand-gold)]">
                      {t(`weekly_case_status_${eff}`)}
                    </span>
                    <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                      {t(`weekly_case_visibility_${c.resolution_visibility}`)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                    {fmt(c.window_start)} – {fmt(c.window_end)}
                  </p>
                </div>

                {(eff === 'closed' || eff === 'resolved') && (
                  <button
                    onClick={() => setResolving(c)}
                    className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-brand-gold-muted)] hover:text-[var(--color-brand-gold)]"
                    aria-label={t('weekly_case_publish_resolution')}
                    title={t('weekly_case_publish_resolution')}
                  >
                    <BookCheck className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => { setEditing(c); setFormOpen(true); }}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                  aria-label={t('admin_edit')}
                  title={t('admin_edit')}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => setDeleting(c)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                  aria-label={t('admin_delete')}
                  title={t('admin_delete')}
                >
                  <Trash2 className="size-4" />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <WeeklyCaseFormModal open={formOpen} onClose={() => setFormOpen(false)} caseItem={editing} />
      <ResolutionModal open={resolving !== null} onClose={() => setResolving(null)} caseItem={resolving} />

      <ConfirmDeleteModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        entityName={deleting?.title ?? ''}
        entityType={t('weekly_case_entity').toLowerCase()}
      />
    </div>
  );
}
