'use client';

import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { Card } from '@/components/common/Card';
import type { ReferralUsageEnriched } from '@/lib/referidos/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ListaReferidosProps {
  usages: ReferralUsageEnriched[];
  showRewards: boolean;
}

export function ListaReferidos({ usages, showRewards }: ListaReferidosProps) {
  const t = useTranslations('referidos');

  return (
    <Card className="p-[var(--space-md)]">
      <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-[var(--space-md)]">
        {t('mis_referidos')}
      </h3>

      {usages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="bg-[var(--color-bg-secondary)] p-4 rounded-full mb-4">
            <Users className="size-8 text-[var(--color-text-muted)]" />
          </div>
          <p className="text-[var(--color-text-secondary)] font-medium">{t('sin_referidos')}</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm">
            {t('sin_referidos_desc')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">{t('columna_nombre')}</th>
                <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">{t('columna_fecha_registro')}</th>
                {showRewards && (
                  <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">{t('columna_recompensa')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {usages.map((u) => (
                <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                    {u.referred_user.nombre} {u.referred_user.apellido}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {format(new Date(u.used_at), "dd 'de' MMM, yyyy", { locale: es })}
                  </td>
                  {showRewards && (
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {u.rewards_applied.rewards.map(r => r.description).join(', ') || '-'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
