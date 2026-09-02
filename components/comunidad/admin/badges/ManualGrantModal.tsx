'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useAdminUsers, useGrantBadge } from '@/lib/hooks/useComunidadAdmin';
import type { AdminBadge } from '@/lib/comunidad/badge';

/** Manual badge grant (Req. 5): pick a user and grant the badge. */
export function ManualGrantModal({
  open,
  onClose,
  badge,
}: {
  open: boolean;
  onClose: () => void;
  badge: AdminBadge;
}) {
  const t = useTranslations('comunidadEstrategica');
  const [search, setSearch] = useState('');
  const { data: users } = useAdminUsers(search);
  const grant = useGrantBadge();

  const onGrant = async (userId: string) => {
    try {
      await grant.mutateAsync({ badge_id: badge.id, user_id: userId });
      toast.success(t('badge_grant_success'));
      onClose();
    } catch (e) {
      const code = (e as { message?: string })?.message;
      toast.error(code === 'ALREADY_OWNED' ? t('badge_grant_already') : t('admin_error'));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('badge_grant_title', { name: badge.name })}>
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('badge_grant_search_placeholder')}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none"
        />
        <div className="max-h-80 divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {(users ?? []).length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-text-muted)]">{t('badge_grant_no_users')}</p>
          ) : (
            (users ?? []).map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {u.nombre} {u.apellido}
                  </div>
                  <div className="truncate text-xs text-[var(--color-text-muted)]">{u.email} · {t(`rol_${u.rol}`)}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => onGrant(u.id)} loading={grant.isPending}>
                  {t('badge_grant_action')}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
