'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { useTenant } from '@/config/client';
import { useScoreReset, useScoreResetLog } from '@/lib/hooks/useComunidadAdmin';
import type { ScoreResetPayload } from '@/lib/comunidad/admin';

/** Danger zone: non-destructive score reset with exact confirmation (Req. 16/17). */
export function DangerZoneTab() {
  const t = useTranslations('comunidadEstrategica');
  const tenant = useTenant();
  const reset = useScoreReset();
  const { data: log } = useScoreResetLog();

  const [scope, setScope] = useState<string>('');
  const [confirmation, setConfirmation] = useState('');

  const canReset = scope !== '' && confirmation === tenant.id;

  const onReset = async () => {
    if (!canReset) return;
    try {
      await reset.mutateAsync({ scope: scope as ScoreResetPayload['scope'], confirmation });
      toast.success(t('danger_reset_done'));
      setConfirmation('');
      setScope('');
    } catch (e) {
      const code = (e as { message?: string })?.message;
      toast.error(code === 'CONFIRMATION_MISMATCH' ? t('danger_confirm_mismatch') : t('admin_error'));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card
        padding="lg"
        className="flex flex-col gap-4 border-[var(--color-error)]/40"
      >
        <div className="flex items-center gap-2 text-[var(--color-error)]">
          <AlertTriangle className="size-5" />
          <h3 className="font-semibold">{t('danger_reset_title')}</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">{t('danger_reset_desc')}</p>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('danger_scope')}
          </span>
          <AppSelect
            value={scope}
            onChange={setScope}
            placeholder={t('danger_scope_placeholder')}
            options={[
              { value: 'current-month-ranking-only', label: t('danger_scope_month') },
              { value: 'full-history-archive', label: t('danger_scope_full') },
            ]}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('danger_confirm_label', { text: tenant.id })}
          </span>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm focus:border-[var(--color-error)] focus:outline-none"
          />
        </label>

        <div className="flex justify-end">
          <Button variant="danger" disabled={!canReset} loading={reset.isPending} onClick={onReset}>
            {t('danger_reset_button')}
          </Button>
        </div>
      </Card>

      <Card padding="lg" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('danger_history')}
        </h3>
        {(log ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('danger_history_empty')}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] text-sm">
            {(log ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between py-2">
                <span className="text-[var(--color-text-primary)]">
                  {new Date(entry.executed_at).toLocaleString('es-CL')}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {entry.reset_scope === 'full-history-archive'
                    ? t('danger_scope_full')
                    : t('danger_scope_month')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
