/**
 * Slice `calendario` — colores de Categoria_Agenda (Requisitos 10.1, 10.5, 15.6).
 *
 * Todos los valores son variables CSS. Ningún color hexadecimal aparece aquí.
 * Los componentes del calendario usan estas referencias para pintar los eventos
 * de agenda con el mismo color que la leyenda les asigna.
 */

import type { CategoriaAgenda } from '@/lib/supabase/types';

// ─── Mapa de colores ────────────────────────────────────────────────────────

/** Ocho colores distintos, uno por valor del enum `agenda_categoria`. */
export const COLORES_CATEGORIA: Record<CategoriaAgenda, string> = {
  clase: 'var(--color-agenda-clase)',
  reunion: 'var(--color-agenda-reunion)',
  estudio: 'var(--color-agenda-estudio)',
  personal: 'var(--color-agenda-personal)',
  administrativo: 'var(--color-agenda-administrativo)',
  evento_externo: 'var(--color-agenda-evento-externo)',
  plazo: 'var(--color-agenda-plazo)',
  otro: 'var(--color-agenda-otro)',
};

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Devuelve la variable CSS correspondiente a una categoría.
 * Si la categoría no se reconoce (nunca debería pasar con el enum), retorna
 * el color de `otro` como fallback seguro.
 */
export function colorDeCategoria(categoria: CategoriaAgenda): string {
  return COLORES_CATEGORIA[categoria] ?? COLORES_CATEGORIA.otro;
}
