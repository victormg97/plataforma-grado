// Agrupación de enlaces por estado, derivada de los datos (sin lista fija).

export interface ConEstado {
  estado: string;
}

export interface GrupoEstado<T extends ConEstado> {
  estado: string;
  items: T[];
}

// Orden preferido de estados en la UI: activos primero, usados al final.
const ORDEN_ESTADOS: Record<string, number> = {
  activo: 0,
  deshabilitado: 1,
  usado: 2,
};

/**
 * Agrupa los enlaces por `estado`. Los grupos se ordenan: activo → deshabilitado
 * → usado → cualquier estado desconocido. Dentro de cada grupo el orden de
 * entrada se preserva.
 */
export function agruparPorEstado<T extends ConEstado>(enlaces: T[]): GrupoEstado<T>[] {
  const mapa = new Map<string, T[]>();

  for (const e of enlaces) {
    if (!mapa.has(e.estado)) mapa.set(e.estado, []);
    mapa.get(e.estado)!.push(e);
  }

  return Array.from(mapa.entries())
    .sort(([a], [b]) => {
      const oa = ORDEN_ESTADOS[a] ?? 99;
      const ob = ORDEN_ESTADOS[b] ?? 99;
      return oa - ob;
    })
    .map(([estado, items]) => ({ estado, items }))
    .filter((g) => g.items.length > 0);
}

/**
 * Etiqueta legible de un estado. Usa la traducción si existe; en caso contrario
 * cae a una representación legible del propio string (extensibilidad: un estado
 * futuro no rompe la UI).
 */
export function etiquetaEstado(
  estado: string,
  t?: (key: string) => string,
): string {
  if (t) {
    const traducido = t(estado);
    // next-intl devuelve la clave (a veces prefijada) cuando no hay traducción.
    if (traducido && traducido !== estado && !traducido.endsWith(`.${estado}`)) {
      return traducido;
    }
  }
  // Fallback legible: "en_revision" -> "En revision"
  const limpio = estado.replace(/[_-]+/g, ' ').trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}
