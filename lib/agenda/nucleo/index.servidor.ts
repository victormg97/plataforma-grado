/**
 * Barrel de servidor del slice nucleo.
 *
 * Reexporta unicamente las funciones que hacen import de valor de
 * lib/supabase/server (cookies, headers). Estos modulos NO pueden incluirse
 * en un bundle de cliente.
 *
 * Las funciones de repositorio (leerEventoPorId, desactivarEvento,
 * leerEventosEnRango) solo usan import type de server, por lo que permanecen
 * en el barrel principal (index.ts) sin causar problemas de bundling.
 */

// ─── Prefetch (usa import de valor de createClient) ─────────────────────────
export { prefetchAgendaMes } from './prefetch';
