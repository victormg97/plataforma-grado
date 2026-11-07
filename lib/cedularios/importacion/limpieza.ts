/**
 * Text cleaning for the cedulario importer. Pure and deterministic.
 *
 * Turns converted-PDF markdown (ilovepdf, cloudconvert, pdfjs) into plain lines: removes HTML
 * comments (including the "picture text" blocks some converters emit), HTML tags, markdown
 * decoration, bullets, bare page numbers and private-use glyphs. Blank lines are dropped.
 * Every surviving line keeps its original 1-based line number.
 */

import type { LineaLimpia } from './tipos';

const BOM = /^\uFEFF/;
/** Private-use area (symbol-font bullets) and common bullet glyphs. */
const GLIFOS_VIÑETA = /[\uE000-\uF8FF\u2022\u25CF\u25AA\u25A0\u00B7\u2023\u2043]/g;
const VIÑETA_INICIAL = /^(?:[-*+\u2013\u2014]\s+)+/;
const NUMERO_PAGINA = /^(?:(?:p[aá]gina|p[aá]g\.?|page|p\.)\s*)?\d{1,4}(?:\s*(?:de|of|\/)\s*\d{1,4})?$/i;
const SOLO_SIGNOS = /^[\s_\-=*.·~|]+$/;

/** Replaces every HTML comment with the same number of newlines so line numbers stay valid. */
function quitarComentarios(texto: string): string {
  const conservarSaltos = (m: string) => m.replace(/[^\n]/g, '');
  // OCR'd letterheads: the text lives BETWEEN a "Start of picture text" and an "End" comment.
  let salida = texto.replace(
    /<!--\s*start of picture text\s*-->[\s\S]*?<!--\s*end of picture text\s*-->/gi,
    conservarSaltos,
  );
  salida = salida.replace(/<!--[\s\S]*?-->/g, conservarSaltos);
  // A converter that crashed may leave an unterminated comment: drop it up to the end.
  salida = salida.replace(/<!--[\s\S]*$/, conservarSaltos);
  return salida;
}

/** Cleans a single physical line (no comment handling). Returns '' when nothing is left. */
export function limpiarLinea(linea: string): string {
  let t = linea.replace(/\t/g, ' ');
  t = t.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-zA-Z][^>]*>/g, '');
  t = t.replace(GLIFOS_VIÑETA, ' ');
  // Markdown decoration: headers, emphasis, inline code, escapes.
  t = t.replace(/^\s*#{1,6}\s*/, '');
  t = t.replace(/\*\*|__|`/g, '');
  t = t.replace(/\\([\\.\-_*#()[\]{}!+>~|])/g, '$1');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(VIÑETA_INICIAL, '');
  // A header marker may follow a bullet ("- ## 1. Foo"); strip once more.
  t = t.replace(/^#{1,6}\s*/, '').trim();
  if (t === '' || SOLO_SIGNOS.test(t) || NUMERO_PAGINA.test(t)) return '';
  return t;
}

/** Cleans a whole text into non-empty lines with their original line numbers. */
export function limpiarTexto(texto: string): LineaLimpia[] {
  const normalizado = quitarComentarios(texto.replace(BOM, '').replace(/\r\n?/g, '\n'));
  const lineas: LineaLimpia[] = [];
  const crudas = normalizado.split('\n');
  for (let i = 0; i < crudas.length; i += 1) {
    const limpia = limpiarLinea(crudas[i]);
    if (limpia !== '') lineas.push({ texto: limpia, numero: i + 1 });
  }
  return lineas;
}

/** Collapses whitespace and removes trailing colons (labels never keep them in the name). */
export function normalizarNombre(nombre: string): string {
  return nombre.replace(/\s+/g, ' ').replace(/[\s:]+$/, '').trim();
}
