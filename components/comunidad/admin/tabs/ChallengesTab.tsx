'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Swords } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ConfirmDeleteModal } from '@/components/common/ConfirmDeleteModal';
import { useAdminChallenges, useDeleteChallenge } from '@/lib/hooks/useComunidadAdmin';
import type { GameChallenge } from '@/lib/supabase/types';
import { ChallengeFormModal } from '../challenges/ChallengeFormModal';
import { ConfigCallout, ConfigListHeader, ConfigEmptyState } from '../ui';

/** Challenge CRUD tab (Req. 14). */
export function ChallengesTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data: challenges, isLoading } = useAdminChallenges();
  const del = useDeleteChallenge();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GameChallenge | null>(null);
  const [deleting, setDeleting] = useState<GameChallenge | null>(null);

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
    <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setModalOpen(true); }}>
      {t('challenge_create')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <ConfigCallout title={t('challenges_intro_title')}>{t('challenges_intro_desc')}</ConfigCallout>

      <ConfigListHeader
        icon={<Swords className="size-4" />}
        title={t('challenges_list_title')}
        description={t('challenges_list_desc')}
        count={(challenges ?? []).length}
        action={createButton}
      />

      {isLoading ? (
        <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>
      ) : (challenges ?? []).length === 0 ? (
        <ConfigEmptyState
          icon={<Swords className="size-8" />}
          message={t('challenge_empty_admin')}
          action={createButton}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(challenges ?? []).map((c) => (
            <Card key={c.id} padding="lg" className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">{c.title}</span>
                  <span className="rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-brand-gold)]">
                    {t(`challenge_period_${c.period_type}`)}
                  </span>
                  {!c.enabled && (
                    <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                      {t('admin_disabled')}
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-[var(--color-text-muted)]">{c.description}</p>
                )}
              </div>
              <button
                onClick={() => { setEditing(c); setModalOpen(true); }}
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
          ))}
        </div>
      )}

      <ChallengeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        challenge={editing}
      />

      <ConfirmDeleteModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        entityName={deleting?.title ?? ''}
        entityType={t('challenge_entity').toLowerCase()}
      />
    </div>
  );
}
