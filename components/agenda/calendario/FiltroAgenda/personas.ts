/**
 * Tipos y utilidades compartidas por las piezas del Filtro_Agenda que trabajan
 * con personas (selector, chips, panel).
 */

/** Persona que se puede elegir en el filtro (profesor, admin o alumno). */
export interface PersonaFiltro {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  avatar_url?: string | null;
  /** `admin` muestra una insignia en la lista de profesores. */
  rol?: string;
  /** Texto secundario opcional (p. ej. el correo) para distinguir homónimos. */
  detalle?: string | null;
}

export function nombreCompleto(p: PersonaFiltro): string {
  return [p.nombre, p.apellido, p.apellido_materno].filter(Boolean).join(' ');
}

/** Nombre corto para chips: «Nombre Apellido». */
export function nombreCorto(p: PersonaFiltro): string {
  return [p.nombre, p.apellido].filter(Boolean).join(' ');
}

/** Minúsculas y sin tildes, para búsquedas tolerantes. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Ordena alfabéticamente dejando primero al usuario actual. */
export function ordenarPersonas(
  personas: PersonaFiltro[],
  usuarioActualId?: string,
): PersonaFiltro[] {
  return [...personas].sort((a, b) => {
    if (a.id === usuarioActualId) return -1;
    if (b.id === usuarioActualId) return 1;
    return nombreCompleto(a).localeCompare(nombreCompleto(b), 'es');
  });
}
