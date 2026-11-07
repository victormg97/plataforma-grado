/**
 * Shared types of the per-student cedulario tracking (phase 2).
 * Pure module: no React, no Supabase.
 */

/** Coverage state of a progress row. A covered row always has a non-null `fechaCubierta`. */
export type Cobertura = 'pendiente' | 'cubierta';

/** One progress row of a student in a materia, plus the counts of its child records. */
export interface ProgresoFila {
  id: string;
  materiaId: string;
  /** False means the materia is archived: data is kept but it no longer counts. */
  asignada: boolean;
  estado: Cobertura;
  /** 'yyyy-MM-dd' or null when the materia is pending. */
  fechaCubierta: string | null;
  notas: string | null;
  repasos: number;
  comentarios: number;
  clases: number;
  updatedAt: string;
}

/**
 * Role of an active materia inside the tree of an assignment:
 * 'asignada' has a progress row with asignada = true,
 * 'contexto' is only an ancestor of an assigned materia (no checkbox, does not count).
 */
export type RolMateria = 'asignada' | 'contexto';
