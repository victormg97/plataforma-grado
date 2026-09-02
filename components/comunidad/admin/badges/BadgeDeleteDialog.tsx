'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import type { AdminBadge } from '@/lib/comunidad/badge';

/**
 * Safe badge deletion dialog (Req. 8). Warns when the badge was already
 * unlocked by users and shows the affected count; confirming archives
 * (soft-delete) rather than losing trace. Zero grants → plain delete.
 */
export function BadgeDeleteDialog({
  open,
  onClose,
  badge,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  badge: AdminBadge;
  onConfirm: (force: boolean) => void;
  loading?: boolean;
}) {
  const t = useTranslations('comunidadEstrategica');
  const affected = badge.grant_count ?? 0;
  const hasGrants = affected > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('badge_delete_title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('admin_cancel')}</Button>
          <Button variant="danger" loading={loading} onClick={() => onConfirm(hasGrants)}>
            {hasGrants ? t('badge_delete_archive') : t('badge_delete_confirm')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--color-text-primary)]">
          {t('badge_delete_body', { name: badge.name })}
        </p>
        {hasGrants && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-error)]/10 p-3 text-sm text-[var(--color-error)]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{t('badge_delete_has_grants', { count: affected })}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
