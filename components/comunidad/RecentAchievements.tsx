'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Award } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { useGameProfile } from '@/lib/hooks/useComunidad';
import { badgeImageUrl } from './badges/badgeImageUrl';

/**
 * Recent achievements card: the player's latest unlocked badges (count is
 * configurable per tenant via recent_achievements_count). Includes a "ver más"
 * action that navigates to the full badge showcase.
 */
export function RecentAchievements({ onSeeMore }: { onSeeMore?: () => void }) {
  const t = useTranslations('comunidadEstrategica');
  const { data: profile } = useGameProfile();
  const items = profile?.recent_achievements ?? [];

  return (
    <Card padding="lg" className="border-none bg-[var(--game-surface)] shadow-[var(--game-shadow)]">
      <div className="mb-3 flex items-center gap-2">
        <Award className="size-5 text-[var(--game-accent)]" />
        <h3 className="text-lg font-bold text-[var(--game-text)]">{t('achievements_title')}</h3>
        {onSeeMore && (
          <button
            type="button"
            onClick={onSeeMore}
            className="ml-auto text-xs font-semibold text-[var(--game-accent)] hover:underline"
          >
            {t('achievements_see_more')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-sm text-[var(--game-text-muted)]">{t('achievements_empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => {
            const url = badgeImageUrl(a.image_path);
            return (
              <li key={a.id} className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--game-accent-muted)] text-[var(--game-accent)]">
                  {url ? (
                    <Image
                      src={url}
                      alt={a.name}
                      width={36}
                      height={36}
                      className="size-8 rounded-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <Award className="size-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--game-text)]">{a.name}</div>
                  {a.description && (
                    <div className="truncate text-xs text-[var(--game-text-muted)]">{a.description}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
