'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, UserPlus, Award } from 'lucide-react';
import Image from 'next/image';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useAdminBadges, useDeleteBadge } from '@/lib/hooks/useComunidadAdmin';
import type { AdminBadge } from '@/lib/comunidad/badge';
import { badgeImageUrl } from '@/components/comunidad/badges/badgeImageUrl';
import { BadgeFormModal } from '../badges/BadgeFormModal';
import { ManualGrantModal } from '../badges/ManualGrantModal';
import { BadgeDeleteDialog } from '../badges/BadgeDeleteDialog';

/** Badges admin tab: CRUD + manual grant (Req. 1/2/5/6/8). */
export function BadgesTab() {
  const t = useTranslations('comunidadEstrategica');
  const { data: badges, isLoading, isError, refetch } = useAdminBadges();
  const del = useDeleteBadge();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBadge | null>(null);
  const [granting, setGranting] = useState<AdminBadge | null>(null);
  const [deleting, setDeleting] = useState<AdminBadge | null>(null);

  const confirmDelete = async (force: boolean) => {
    if (!deleting) return;
    try {
      await del.mutateAsync({ id: deleting.id, force });
      toast.success(t('admin_deleted'));
      setDeleting(null);
    } catch {
      toast.error(t('admin_error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
          {t('badge_create')}
        </Button>
      </div>

      {isError ? (
        <Card padding="lg" className="flex flex-col items-center gap-3 text-center" role="alert">
          <p className="text-sm text-[var(--color-error)]">{t('error_loading')}</p>
          <Button variant="secondary" onClick={() => refetch()}>{t('error_retry')}</Button>
        </Card>
      ) : isLoading ? (
        <Card padding="lg" role="status" aria-live="polite">{t('admin_loading')}</Card>
      ) : (badges ?? []).filter((b) => !b.deleted_at).length === 0 ? (
        <Card padding="lg">
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">{t('badge_empty_admin')}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {(badges ?? []).filter((b) => !b.deleted_at).map((b) => {
            const url = badgeImageUrl(b.image_path);
            return (
              <Card key={b.id} padding="lg" className="flex items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]">
                  {url ? (
                    <Image src={url} alt={b.name} width={48} height={48} className="size-10 rounded-full object-contain" />
                  ) : (
                    <Award className="size-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--color-text-primary)]">{b.name}</span>
                    <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                      {t(`badge_unlock_${b.unlock_type}`)}
                    </span>
                    {b.series_key && (
                      <span className="rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-brand-gold)]">
                        {b.series_key} · {b.series_order}
                      </span>
                    )}
                    {!b.enabled && (
                      <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                        {t('admin_disabled')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {t('badge_grant_count', { count: b.grant_count ?? 0 })}
                  </p>
                </div>
                <button
                  onClick={() => setGranting(b)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                  aria-label={t('badge_grant_manual')}
                  title={t('badge_grant_manual')}
                >
                  <UserPlus className="size-4" />
                </button>
                <button
                  onClick={() => { setEditing(b); setFormOpen(true); }}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                  aria-label={t('admin_edit')}
                  title={t('admin_edit')}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => setDeleting(b)}
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

      <BadgeFormModal open={formOpen} onClose={() => setFormOpen(false)} badge={editing} />
      {granting && (
        <ManualGrantModal open onClose={() => setGranting(null)} badge={granting} />
      )}
      {deleting && (
        <BadgeDeleteDialog
          open
          onClose={() => setDeleting(null)}
          badge={deleting}
          onConfirm={confirmDelete}
          loading={del.isPending}
        />
      )}
    </div>
  );
}
