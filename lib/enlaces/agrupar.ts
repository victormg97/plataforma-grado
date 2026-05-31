// Agrupación de enlaces por estado, derivada de los datos (sin lista fija).

export interface ConEstado {
  estado: string;
}

export interface GrupoEstado<T extends ConEstado> {
  estado: string;
  items: T[];
}

/**
 * Agrupa los enlaces por `estado` en orden de primera aparición en los datos.
 * No incluye grupos vacíos. La concatenación de los `items` es una permutación
 * exacta de la entrada (ningún elemento perdido ni duplicado).
 */
export function agruparPorEstado<T extends ConEstado>(enlaces: T[]): GrupoEstado<T>[] {
  const orden: string[] = [];
  const mapa = new Map<string, T[]>();

  for (const e of enlaces) {
    if (!mapa.has(e.estado)) {
      mapa.set(e.estado, []);
      orden.push(e.estado);
    }
    mapa.get(e.estado)!.push(e);
  }

  return orden
    .map((estado) => ({ estado, items: mapa.get(estado)! }))
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
