/**
 * Slice `nucleo` — precarga SSR del mes actual (Requisitos 12.11, 17.1, 17.2).
 *
 * Las páginas de agenda invocan `prefetchAgendaMes` desde su Server Component para
 * que el primer render incluya los eventos del mes actual sin loading spinner.
 * Navegar a otro rango dispara una query normal desde el hook.
 *
 * No modifica `lib/prefetch/dashboard.ts`: los mega-RPC existentes se conservan
 * intactos (diseño § Prefetch).
 *
 * Dependencias permitidas: `@/lib/supabase/server`, `@tanstack/react-query`.
 */
import { QueryClient } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/server';

import { clavesAgenda } from './claves';
import { leerEventosEnRango } from './repositorio.rango';
import type { RangoVisible } from './tipos';

/**
 * Calcula el rango del mes actual: primer día hasta último día.
 */
function rangoMesActual(): RangoVisible {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth(); // 0-indexed

  const primero = new Date(anio, mes, 1);
  const ultimo = new Date(anio, mes + 1, 0); // último día del mes

  const formatear = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return { desde: formatear(primero), hasta: formatear(ultimo) };
}

/**
 * Precarga los eventos del mes actual en un `QueryClient` de servidor.
 *
 * Se invoca desde el Server Component de la página de agenda:
 * ```ts
 * const queryClient = new QueryClient();
 * await prefetchAgendaMes(queryClient, userId);
 * // luego <HydrationBoundary state={dehydrate(queryClient)}>
 * ```
 */
export async function prefetchAgendaMes(
  queryClient: QueryClient,
  usuarioId: string,
): Promise<void> {
  const rango = rangoMesActual();
  const supabase = await createClient();

  await queryClient.prefetchQuery({
    queryKey: clavesAgenda.eventos(usuarioId, rango),
    queryFn: () => leerEventosEnRango(supabase, rango),
    staleTime: 5 * 60 * 1000,
  });
}
