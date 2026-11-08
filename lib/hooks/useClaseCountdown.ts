'use client';

import { useEffect, useState } from 'react';
import { useServerTime } from '@/lib/hooks/useServerTime';

export type ClaseCountdownPhase = 'loading' | 'upcoming' | 'live' | 'ended';

export interface ClaseCountdown {
  phase: ClaseCountdownPhase;
  /** Milliseconds until start (upcoming) or until end (live). 0 otherwise. */
  remainingMs: number;
}

const CHILE_TZ = 'America/Santiago';

/** Wall-clock components of an instant in Chile, as a "naive UTC" timestamp. */
function chileWallClockMs(instantMs: number): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/** `YYYY-MM-DD` + `HH:mm[:ss]` as a naive UTC timestamp (a Chile wall-clock time). */
function naiveMs(fecha: string, hora: string): number {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [h, mi, s] = hora.split(':').map(Number);
  return Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, s || 0);
}

/**
 * Ticking countdown to a class start, based on the server clock (Chile time).
 * The server time is fetched periodically (see `useServerTime`); between fetches the
 * hook advances it locally every second, so it never depends on the user's own clock.
 */
export function useClaseCountdown(fecha: string, horaInicio: string, horaFin: string): ClaseCountdown {
  const { serverTime } = useServerTime();
  const [nowServerMs, setNowServerMs] = useState<number | null>(null);

  // Anchor on each fresh server time, then advance it locally once per second.
  useEffect(() => {
    if (!serverTime) return;
    const serverMs = new Date(serverTime).getTime();
    if (Number.isNaN(serverMs)) return;
    const clientAtFetch = Date.now();
    const update = () => setNowServerMs(serverMs + (Date.now() - clientAtFetch));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [serverTime]);

  if (nowServerMs === null || !fecha || !horaInicio) return { phase: 'loading', remainingMs: 0 };

  const nowChile = chileWallClockMs(nowServerMs);
  const start = naiveMs(fecha, horaInicio);
  const end = naiveMs(fecha, horaFin || horaInicio);

  if (nowChile < start) return { phase: 'upcoming', remainingMs: start - nowChile };
  if (nowChile <= end) return { phase: 'live', remainingMs: end - nowChile };
  return { phase: 'ended', remainingMs: 0 };
}