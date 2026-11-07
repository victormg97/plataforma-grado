/**
 * Keyboard navigation of the materia tree (treeitem rows).
 * Pure module: no React, no Supabase.
 */

export interface FilaNavegable {
  id: string;
  tieneHijos: boolean;
  expandido: boolean;
  parentId: string | null;
}

export type TeclaArbol = 'ArrowDown' | 'ArrowUp' | 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End';

export interface ResultadoFoco {
  indice: number;
  accion: 'foco' | 'expandir' | 'contraer';
}

/**
 * Next focus for a key press on the visible rows.
 * - ArrowDown/ArrowUp move one row and stop at both ends.
 * - Home/End jump to the first/last row.
 * - ArrowRight on a collapsed parent asks to expand; on an expanded parent it moves
 *   to its first child; on a leaf it does nothing.
 * - ArrowLeft on an expanded parent asks to collapse; otherwise it moves to the parent
 *   row (when visible) or stays.
 * The returned index is always inside the list (0 for an empty list).
 */
export function siguienteFoco(
  filas: ReadonlyArray<FilaNavegable>,
  indice: number,
  tecla: TeclaArbol,
): ResultadoFoco {
  const ultimo = filas.length - 1;
  if (ultimo < 0) return { indice: 0, accion: 'foco' };

  const actual = Math.min(Math.max(Math.trunc(indice) || 0, 0), ultimo);
  const fila = filas[actual];

  switch (tecla) {
    case 'ArrowDown':
      return { indice: Math.min(actual + 1, ultimo), accion: 'foco' };
    case 'ArrowUp':
      return { indice: Math.max(actual - 1, 0), accion: 'foco' };
    case 'Home':
      return { indice: 0, accion: 'foco' };
    case 'End':
      return { indice: ultimo, accion: 'foco' };
    case 'ArrowRight': {
      if (!fila.tieneHijos) return { indice: actual, accion: 'foco' };
      if (!fila.expandido) return { indice: actual, accion: 'expandir' };
      const siguiente = filas[actual + 1];
      if (siguiente && siguiente.parentId === fila.id) {
        return { indice: actual + 1, accion: 'foco' };
      }
      return { indice: actual, accion: 'foco' };
    }
    case 'ArrowLeft': {
      if (fila.tieneHijos && fila.expandido) return { indice: actual, accion: 'contraer' };
      if (fila.parentId !== null) {
        // The parent is always above its children in a flattened tree.
        for (let i = actual - 1; i >= 0; i--) {
          if (filas[i].id === fila.parentId) return { indice: i, accion: 'foco' };
        }
      }
      return { indice: actual, accion: 'foco' };
    }
  }
}
