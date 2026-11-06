'use client';

/**
 * Slice `calendario` — hook del Filtro_Agenda (Requisito 12.3).
 *
 * Lee el filtro de los query params (`agenda`, `prof`, `alu`) y lo escribe con
 * `history.replaceState`. A diferencia de `router.replace`, no dispara una
 * navegación del App Router (sin viaje al servidor), así que cada clic en el
 * filtro se refleja al instante. Next.js sincroniza `useSearchParams` con
 * `replaceState`, por lo que todos los componentes que usan este hook se
 * actualizan a la vez.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  PARAM_ALUMNOS,
  PARAM_PROFESORES,
  PARAM_TIPOS,
  parsearFiltro,
  serializarFiltroCompleto,
  type FiltroAgenda,
} from '../filtro';

type ActualizacionFiltro = FiltroAgenda | ((previo: FiltroAgenda) => FiltroAgenda);

/**
 * Hook que gestiona el estado del Filtro_Agenda a través de la URL.
 *
 * @returns Una tupla `[filtro, setFiltro]` donde:
 *   - `filtro` es el estado actual. Su identidad es estable mientras la URL no cambie.
 *   - `setFiltro` acepta el nuevo filtro o una función `(previo) => nuevo`. La forma
 *     funcional parte siempre de la URL vigente, por lo que dos clics seguidos no
 *     se pisan.
 */
export function useFiltroAgenda(): [FiltroAgenda, (actualizacion: ActualizacionFiltro) => void] {
  const searchParams = useSearchParams();
  const tipos = searchParams.get(PARAM_TIPOS);
  const profesores = searchParams.get(PARAM_PROFESORES);
  const alumnos = searchParams.get(PARAM_ALUMNOS);

  const filtro = useMemo(
    () => parsearFiltro(tipos, profesores, alumnos),
    [tipos, profesores, alumnos],
  );

  const setFiltro = useCallback((actualizacion: ActualizacionFiltro) => {
    const params = new URLSearchParams(window.location.search);
    const previo = parsearFiltro(
      params.get(PARAM_TIPOS),
      params.get(PARAM_PROFESORES),
      params.get(PARAM_ALUMNOS),
    );
    const nuevo = typeof actualizacion === 'function' ? actualizacion(previo) : actualizacion;
    const serializado = serializarFiltroCompleto(nuevo);

    const escribir = (clave: string, valor: string | null) => {
      if (valor === null) params.delete(clave);
      else params.set(clave, valor);
    };
    escribir(PARAM_TIPOS, serializado.agenda);
    escribir(PARAM_PROFESORES, serializado.prof);
    escribir(PARAM_ALUMNOS, serializado.alu);

    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    // Se pasa `null` a propósito: si se reenvía `window.history.state` (que ya trae
    // las claves internas `__NA`), Next.js lo toma como un cambio propio y NO
    // sincroniza `useSearchParams`. Con `null` copia su estado y actualiza el router.
    window.history.replaceState(null, '', url);
  }, []);

  return [filtro, setFiltro];
}
