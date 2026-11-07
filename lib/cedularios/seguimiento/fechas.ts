/**
 * Date helpers of the tracking, based on the platform time zone.
 * Pure module: no React, no Supabase.
 */

import { PLATFORM_TIMEZONE } from './constants';

/** Today's date as 'yyyy-MM-dd' in the platform time zone (America/Santiago). */
export function hoyEnChile(ahora: Date = new Date()): string {
  // The 'en-CA' locale formats dates as yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PLATFORM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/**
 * Whether `fecha` ('yyyy-MM-dd') is later than `hoy`.
 * ISO dates compare correctly as strings.
 */
export function esFechaFutura(fecha: string, hoy: string = hoyEnChile()): boolean {
  return fecha > hoy;
}
