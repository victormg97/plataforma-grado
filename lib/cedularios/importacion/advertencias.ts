/**
 * Validation findings for an import tree. Pure and deterministic.
 *
 * Hard errors (`severidad: 'error'`) mirror what the database or the Server Action would
 * reject; the review UI disables saving while any exists. Soft warnings (`'aviso'`) only flag
 * things worth a second look. Messages are resolved in the UI from `tipo` (i18n), never here.
 */

import { LIMITES_IMPORTACION, type Advertencia, type NodoImportacion } from './tipos';

/** Same comparison as the `uq_materias_codigo_hermanos` index: trimmed, case-insensitive. */
function normalizarCodigo(codigo: string): string {
  return codigo.trim().toLowerCase();
}

/**
 * Validates the tree structure and field limits. `nodoKey` identifies the offending item so
 * the UI can jump to it. Returns only findings produced by this validation; parser findings
 * (numbering gaps, stray lines) are merged by the caller.
 */
export function validarArbol(raiz: readonly NodoImportacion[]): Advertencia[] {
  const hallazgos: Advertencia[] = [];
  let total = 0;

  if (raiz.length === 0) {
    hallazgos.push({ tipo: 'sin_estructura', severidad: 'error' });
    return hallazgos;
  }

  const recorrer = (nodos: readonly NodoImportacion[], profundidad: number): void => {
    const vistos = new Set<string>();
    for (const n of nodos) {
      total += 1;
      const base = { nodoKey: n.key, linea: n.lineaOrigen > 0 ? n.lineaOrigen : undefined };
      const nombre = n.nombre.trim();

      if (profundidad > LIMITES_IMPORTACION.profundidad) {
        hallazgos.push({
          tipo: 'profundidad_excedida',
          severidad: 'error',
          ...base,
          params: { profundidad, maximo: LIMITES_IMPORTACION.profundidad },
        });
      }
      if (nombre === '') {
        hallazgos.push({ tipo: 'nombre_vacio', severidad: 'error', ...base });
      } else if (nombre.length > LIMITES_IMPORTACION.nombre) {
        hallazgos.push({
          tipo: 'nombre_muy_largo',
          severidad: 'error',
          ...base,
          params: { largo: nombre.length, maximo: LIMITES_IMPORTACION.nombre },
        });
      } else if (nombre.length > LIMITES_IMPORTACION.nombreLargo) {
        hallazgos.push({ tipo: 'nombre_largo', severidad: 'aviso', ...base, params: { largo: nombre.length } });
      }

      const codigo = normalizarCodigo(n.codigo);
      if (codigo === '' || codigo.length > LIMITES_IMPORTACION.codigo) {
        hallazgos.push({
          tipo: 'codigo_muy_largo',
          severidad: 'error',
          ...base,
          params: { largo: codigo.length, maximo: LIMITES_IMPORTACION.codigo },
        });
      } else if (vistos.has(codigo)) {
        hallazgos.push({ tipo: 'codigo_duplicado', severidad: 'error', ...base, params: { codigo: n.codigo } });
      }
      vistos.add(codigo);

      recorrer(n.children, profundidad + 1);
    }
  };
  recorrer(raiz, 1);

  if (total > LIMITES_IMPORTACION.nodos) {
    hallazgos.push({
      tipo: 'demasiados_nodos',
      severidad: 'error',
      params: { total, maximo: LIMITES_IMPORTACION.nodos },
    });
  }
  return hallazgos;
}

export function hayErrores(advertencias: readonly Advertencia[]): boolean {
  return advertencias.some((a) => a.severidad === 'error');
}
