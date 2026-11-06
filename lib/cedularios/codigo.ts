/**
 * Código helpers for materias (decision D-7).
 *
 * Pure TypeScript. A código is unique among ACTIVE siblings (same cedulario and same
 * parent), compared after trimming and ignoring letter case. The same código is allowed
 * under different parents and on inactive materias. Length/emptiness rules (1-30 chars)
 * live in the Zod schema; these helpers only deal with uniqueness and suggestions.
 */

import type { MateriaNodo } from './tree';

const CODIGO_MAX = 30;
/** Only the last digits of a sibling código are read, so huge numbers never lose precision. */
const DIGITOS_MAX = 9;

/** Normal form used to compare códigos: trimmed and lower-cased. */
export function normalizarCodigo(c: string): string {
  return c.trim().toLowerCase();
}

/**
 * True when no active materia in `hermanos` (the siblings under the target parent) has the
 * same normalized código. `excluirId` skips the materia being edited or moved.
 */
export function codigoDisponible(hermanos: MateriaNodo[], codigo: string, excluirId?: string): boolean {
  const objetivo = normalizarCodigo(codigo);
  return !hermanos.some(
    (h) => h.activo && h.id !== excluirId && normalizarCodigo(h.codigo) === objetivo,
  );
}

/**
 * Suggests the next código under `padre` (null = root level). The result is never empty,
 * has at most 30 characters, and differs (normalized) from the código of every sibling in
 * `hermanos`, active or not.
 *
 * Shape: `<padre.codigo>.<n>` under a parent, `<n>` at root level, where `n` is one more than
 * the highest trailing number among the siblings (or the sibling count + 1 when none has one).
 * When the prefix would push the result past 30 characters, the prefix is dropped.
 */
export function sugerirCodigo(padre: MateriaNodo | null, hermanos: MateriaNodo[]): string {
  const usados = new Set(hermanos.map((h) => normalizarCodigo(h.codigo)));

  let maxNumero = 0;
  let conNumero = 0;
  for (const h of hermanos) {
    const m = new RegExp(`(\\d{1,${DIGITOS_MAX}})\\s*$`).exec(h.codigo);
    if (m) {
      conNumero += 1;
      const n = parseInt(m[1], 10);
      if (n > maxNumero) maxNumero = n;
    }
  }

  const prefijoBase = padre ? padre.codigo.trim() : '';
  const prefijo = prefijoBase.length > 0 ? `${prefijoBase}.` : '';

  let n = conNumero > 0 ? maxNumero + 1 : hermanos.length + 1;
  // Terminates: `usados` is finite and `n` grows by 1 on every collision.
  for (;;) {
    const sufijo = String(n);
    const conPrefijo = `${prefijo}${sufijo}`;
    const candidato = conPrefijo.length <= CODIGO_MAX ? conPrefijo : sufijo;
    if (candidato.length <= CODIGO_MAX && !usados.has(normalizarCodigo(candidato))) {
      return candidato;
    }
    n += 1;
  }
}
