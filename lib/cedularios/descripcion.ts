/**
 * Helpers for the cedulario `descripcion`, which is stored as the HTML produced by the TipTap
 * editor. Older rows hold plain text (with line breaks), so both shapes must be handled.
 */

const PARECE_HTML = /<[a-z][\s\S]*>/i;

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** HTML the editor can load: plain text is escaped and split into paragraphs. */
export function descripcionAHtml(valor: string | null | undefined): string {
  const texto = valor ?? '';
  if (texto.trim() === '') return '';
  if (PARECE_HTML.test(texto)) return texto;
  return texto
    .split(/\r?\n/)
    .map((linea) => `<p>${linea === '' ? '<br>' : escaparHtml(linea)}</p>`)
    .join('');
}

/** `true` when the HTML has no visible content (for example `<p></p>`). */
export function descripcionVacia(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

/** Value to store: an empty editor is saved as an empty string, not as `<p></p>`. */
export function normalizarDescripcion(html: string): string {
  return descripcionVacia(html) ? '' : html;
}
