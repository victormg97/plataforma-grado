// Filtrado puro de enlaces por creador y tipo, y derivación de opciones.

export interface FiltrableEnlace {
  created_by: string | null;
  tipo: string;
}

export interface FiltroState {
  creador: string | null;
  tipo: string | null;
}

/**
 * Filtra la lista por creador y tipo (conjunción AND). Conserva el orden de
 * entrada. Cuando ambos filtros son `null` devuelve la lista completa.
 */
export function filtrarEnlaces<T extends FiltrableEnlace>(
  enlaces: T[],
  { creador, tipo }: FiltroState,
): T[] {
  return enlaces.filter(
    (e) =>
      (creador === null || e.created_by === creador) &&
      (tipo === null || e.tipo === tipo),
  );
}

/**
 * Valores distintos presentes en un campo dado, en orden de primera aparición.
 * Ignora valores `null`/`undefined`.
 */
export function opcionesDistintas<T, K extends keyof T>(
  enlaces: T[],
  campo: K,
): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const e of enlaces) {
    const v = e[campo];
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (!vistos.has(s)) {
      vistos.add(s);
      out.push(s);
    }
  }
  return out;
}

/**
 * Un filtro debe deshabilitarse solo cuando no hay ningún valor disponible,
 * o cuando hay exactamente un valor Y no hay filtro activo (no tiene sentido
 * seleccionar el único valor existente si no puedes comparar con otro).
 * Si el usuario ya tiene un filtro activo, siempre puede quitarlo.
 */
export function filtroDeshabilitado(valoresDistintos: string[], valorActual?: string | null): boolean {
  if (valorActual) return false; // siempre puede deseleccionar
  return valoresDistintos.length === 0;
}
