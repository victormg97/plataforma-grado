/**
 * Slice `calendario` — leyenda del Rango_Visible (Requisito 12.4).
 *
 * La leyenda solo incluye tipos y categorías **presentes** en los eventos
 * recibidos, no los ocho valores de categoría siempre. Cada entrada usa el mismo
 * color con el que el calendario renderiza ese tipo o esa categoría.
 */

import type { EventoAgendaProyectado, TipoEventoAgenda } from '@/lib/agenda/nucleo';
import type { CategoriaAgenda } from '@/lib/supabase/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface EntradaLeyenda {
  /** e.g. 'tipo:entrada_personal' o 'cat:estudio' */
  key: string;
  /** Texto legible, resuelto por la función de traducción que el llamante pasa. */
  label: string;
  /** Variable CSS, e.g. 'var(--color-agenda-tipo-entrada)' */
  color: string;
}

// ─── Colores de tipo (los mismos que usa el calendario) ─────────────────────

const COLORES_TIPO: Record<TipoEventoAgenda, string> = {
  entrada_personal: 'var(--color-agenda-tipo-entrada)',
  actividad: 'var(--color-agenda-tipo-actividad)',
};

// ─── Colores de categoría ───────────────────────────────────────────────────

const COLORES_CATEGORIA_LEYENDA: Record<CategoriaAgenda, string> = {
  clase: 'var(--color-agenda-clase)',
  reunion: 'var(--color-agenda-reunion)',
  estudio: 'var(--color-agenda-estudio)',
  personal: 'var(--color-agenda-personal)',
  administrativo: 'var(--color-agenda-administrativo)',
  evento_externo: 'var(--color-agenda-evento-externo)',
  plazo: 'var(--color-agenda-plazo)',
  otro: 'var(--color-agenda-otro)',
};

// ─── Función principal ──────────────────────────────────────────────────────

/**
 * Construye las entradas de leyenda a partir de los eventos visibles en el
 * Rango_Visible actual.
 *
 * @param eventos - Eventos proyectados del Rango_Visible.
 * @param tCat - Función de traducción para categorías (recibe la clave del enum).
 * @param tTipo - Función de traducción para tipos de evento (recibe la clave del tipo).
 * @returns Entradas de leyenda: primero las de tipo, luego las de categoría.
 */
export function construirLeyenda(
  eventos: EventoAgendaProyectado[],
  tCat: (key: string) => string,
  tTipo: (key: string) => string,
): EntradaLeyenda[] {
  const tiposPresentes = new Set<TipoEventoAgenda>();
  const categoriasPresentes = new Set<CategoriaAgenda>();

  for (const evento of eventos) {
    tiposPresentes.add(evento.tipo);
    categoriasPresentes.add(evento.categoria);
  }

  const entradas: EntradaLeyenda[] = [];

  // Entradas de tipo (entrada_personal y actividad), en orden estable
  const ordenTipos: TipoEventoAgenda[] = ['entrada_personal', 'actividad'];
  for (const tipo of ordenTipos) {
    if (tiposPresentes.has(tipo)) {
      entradas.push({
        key: `tipo:${tipo}`,
        label: tTipo(tipo),
        color: COLORES_TIPO[tipo],
      });
    }
  }

  // Entradas de categoría, en el orden del enum
  const ordenCategorias: CategoriaAgenda[] = [
    'clase',
    'reunion',
    'estudio',
    'personal',
    'administrativo',
    'evento_externo',
    'plazo',
    'otro',
  ];
  for (const cat of ordenCategorias) {
    if (categoriasPresentes.has(cat)) {
      entradas.push({
        key: `cat:${cat}`,
        label: tCat(cat),
        color: COLORES_CATEGORIA_LEYENDA[cat],
      });
    }
  }

  return entradas;
}
