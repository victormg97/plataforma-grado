'use client';

import { useTranslations } from 'next-intl';
import { Gift, Target } from 'lucide-react';
import { Card } from '@/components/common/Card';
import type { ReferralRewardRule, ReferralUsage } from '@/lib/referidos/types';

interface RecompensasCardProps {
  rules: ReferralRewardRule[];
  usages: ReferralUsage[];
  userId: string;
  showRewards: boolean;
  showCount: boolean;
}

export function RecompensasCard({ rules, usages, userId, showRewards, showCount }: RecompensasCardProps) {
  const t = useTranslations('referidos');

  if (!showRewards && !showCount) {
    return null;
  }

  // Calculate current month's referrals
  const now = new Date();
  const currentMonthUsages = usages.filter(u => {
    const date = new Date(u.used_at);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && u.referred_user_id !== userId;
  });
  
  // Find volume rule if any
  const volumeRule = rules.find(r => r.rule_type === 'volume_goal');

  return (
    <Card className="p-[var(--space-md)]">
      <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-[var(--space-md)] flex items-center gap-2">
        <Gift className="size-5 text-[var(--color-brand-gold)]" />
        {t('recompensas')}
      </h3>
      
      <div className="space-y-[var(--space-md)]">
        {showCount && (
          <div className="bg-[var(--color-bg-secondary)] p-4 rounded-[var(--radius-md)] flex items-center gap-4">
            <div className="bg-[var(--color-brand-gold-muted)] p-3 rounded-full text-[var(--color-brand-gold)]">
              <Target className="size-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('referidos_este_mes')}</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                {currentMonthUsages.length}
                {volumeRule?.volume_target ? ` ${t('de')} ${volumeRule.volume_target}` : ''}
              </p>
            </div>
          </div>
        )}

        {showRewards && (
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wider">
              {t('recompensas_activas')}
            </h4>
            {rules.filter(r => r.rule_type === 'referrer').length > 0 ? (
               <ul className="space-y-2">
                 {rules.filter(r => r.rule_type === 'referrer').map(r => (
                    <li key={r.id} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)] border border-[var(--color-border)] p-3 rounded-[var(--radius-md)]">
                      <Gift className="size-4 text-[var(--color-brand-gold)] mt-0.5 shrink-0" />
                      <span>Premio por cada referido exitoso</span>
                    </li>
                 ))}
               </ul>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No hay recompensas activas configuradas actualmente.</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
