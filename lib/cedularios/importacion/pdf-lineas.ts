/**
 * Converts positioned PDF text items into text lines. Pure and deterministic: the pdfjs call
 * itself lives in the client (`components/cedularios/importacion/extraerPdf.ts`).
 *
 * - groups items into lines by vertical position (PDF y grows upwards) and orders them by x;
 * - rebuilds indentation (two spaces per indent step) so the review text stays readable;
 * - drops text that repeats on most pages (headers, footers) and bare page numbers.
 */

export interface ItemTextoPdf {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  /** 1-based page number. */
  page: number;
  /** Rendered width in the same units as `x`, when the extractor knows it. */
  width?: number;
}

interface LineaPdf {
  page: number;
  y: number;
  x: number;
  texto: string;
}

const PAGINA_SOLA = /^(?:(?:p[aá]gina|p[aá]g\.?|page)\s*)?\d{1,4}(?:\s*(?:de|of|\/)\s*\d{1,4})?$/i;

function esFinito(n: number): boolean {
  return Number.isFinite(n);
}

function agruparPagina(items: readonly ItemTextoPdf[]): LineaPdf[] {
  const validos = items.filter((i) => i.str.trim() !== '' && esFinito(i.x) && esFinito(i.y));
  // Top to bottom, then left to right.
  const ordenados = [...validos].sort((a, b) => b.y - a.y || a.x - b.x);

  const filas: ItemTextoPdf[][] = [];
  for (const item of ordenados) {
    const fila = filas[filas.length - 1];
    const tolerancia = Math.max(1, (esFinito(item.fontSize) ? item.fontSize : 10) * 0.5);
    if (fila !== undefined && Math.abs(fila[0].y - item.y) <= tolerancia) fila.push(item);
    else filas.push([item]);
  }

  return filas.map((fila) => {
    const porX = [...fila].sort((a, b) => a.x - b.x);
    let texto = '';
    let finAnterior: number | null = null;
    for (const item of porX) {
      const cuerpo = item.str.replace(/\s+/g, ' ');
      const tamano = esFinito(item.fontSize) && item.fontSize > 0 ? item.fontSize : 10;
      if (texto !== '') {
        const huecoPequeno = finAnterior !== null && item.x - finAnterior < tamano * 0.15;
        if (!huecoPequeno && !texto.endsWith(' ') && !cuerpo.startsWith(' ')) texto += ' ';
      }
      texto += cuerpo;
      finAnterior = item.width !== undefined && esFinito(item.width) ? item.x + item.width : null;
    }
    return { page: porX[0].page, y: porX[0].y, x: porX[0].x, texto: texto.replace(/\s+/g, ' ').trim() };
  });
}

/** Key used to detect running headers/footers: digits collapsed, case and spacing ignored. */
function claveRepetida(texto: string): string {
  return texto.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

/**
 * @returns the text lines of the document, in reading order, ready for `parsearLineas`.
 */
export function lineasDesdeItems(items: readonly ItemTextoPdf[]): string[] {
  const porPagina = new Map<number, ItemTextoPdf[]>();
  for (const item of items) {
    const lista = porPagina.get(item.page);
    if (lista) lista.push(item);
    else porPagina.set(item.page, [item]);
  }
  const paginas = [...porPagina.keys()].sort((a, b) => a - b);
  const lineasPorPagina = paginas.map((p) => agruparPagina(porPagina.get(p) ?? []));

  // Text present on at least 60% of the pages (and 3+ pages) is a running header or footer.
  const repetidas = new Set<string>();
  if (paginas.length >= 3) {
    const conteo = new Map<string, number>();
    for (const lineas of lineasPorPagina) {
      for (const clave of new Set(lineas.map((l) => claveRepetida(l.texto)))) {
        conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
      }
    }
    for (const [clave, veces] of conteo) {
      if (veces >= 3 && veces >= paginas.length * 0.6) repetidas.add(clave);
    }
  }

  const todas = lineasPorPagina.flat().filter((l) => l.texto !== '');
  const margenIzquierdo = todas.length > 0 ? Math.min(...todas.map((l) => l.x)) : 0;

  const salida: string[] = [];
  for (const lineas of lineasPorPagina) {
    for (const l of lineas) {
      if (l.texto === '' || PAGINA_SOLA.test(l.texto) || repetidas.has(claveRepetida(l.texto))) continue;
      const pasos = Math.max(0, Math.min(12, Math.round((l.x - margenIzquierdo) / 14)));
      salida.push(`${'  '.repeat(pasos)}${l.texto}`);
    }
  }
  return salida;
}
