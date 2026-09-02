'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import type { PlayerLives } from '@/lib/comunidad/game-config';

/** Formats a ms duration as mm:ss or h:mm:ss. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Header lives indicator: heart + current/max, plus a live countdown to the
 * next regeneration when lives are not full. Ticks locally each second; the
 * authoritative value is refreshed by the profile query.
 */
export function LivesIndicator({ lives }: { lives: PlayerLives }) {
  const t = useTranslations('comunidadEstrategica');
  const [now, setNow] = useState(() => Date.now());

  const nextRegenMs = lives.next_regen ? new Date(lives.next_regen).getTime() : null;

  useEffect(() => {
    if (!nextRegenMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nextRegenMs]);

  const remaining = nextRegenMs ? nextRegenMs - now : 0;

  return (
    <div className="flex items-center gap-2">
      <Heart className="size-6 text-[#e57373]" fill="#e57373" />
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-wide text-white/70">{t('lives_label')}</div>
        <div className="text-sm font-bold">
          {lives.current ?? 0}
          <span className="text-white/60">/{lives.max}</span>
          {nextRegenMs && remaining > 0 && (
            <span className="ml-1 text-[10px] font-medium text-white/70">
              (+1 {formatCountdown(remaining)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
