import { lineasDesdeItems, type ItemTextoPdf } from '@/lib/cedularios/importacion';

/** Why a file could not be read. The UI maps it to `cedularios.importacion.errores.<codigo>`. */
export type CodigoErrorLectura =
  | 'formato_no_soportado'
  | 'archivo_muy_grande'
  | 'archivo_vacio'
  | 'pdf_invalido'
  | 'pdf_sin_texto'
  | 'lectura_fallida';

export class ErrorLectura extends Error {
  constructor(public readonly codigo: CodigoErrorLectura) {
    super(codigo);
    this.name = 'ErrorLectura';
  }
}

/** Minimal shape of a pdfjs text item (marked-content entries have no `str`). */
interface ItemPdfjs {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
}

function aItem(item: ItemPdfjs, page: number): ItemTextoPdf | null {
  if (typeof item.str !== 'string' || !Array.isArray(item.transform)) return null;
  const t = item.transform as number[];
  const alto = typeof item.height === 'number' ? item.height : 0;
  return {
    str: item.str,
    x: t[4],
    y: t[5],
    fontSize: alto > 0 ? alto : Math.hypot(t[0] ?? 0, t[1] ?? 0),
    page,
    width: typeof item.width === 'number' ? item.width : undefined,
  };
}

/**
 * Extracts the text lines of a PDF in the browser (pdfjs-dist, no network, no OCR).
 * Throws `ErrorLectura('pdf_sin_texto')` for scanned PDFs: the text layer is empty and OCR is
 * not supported.
 */
export async function extraerLineasPdf(archivo: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const tarea = pdfjs.getDocument({ data: datos });
  let pdf: Awaited<typeof tarea.promise>;
  try {
    pdf = await tarea.promise;
  } catch {
    throw new ErrorLectura('pdf_invalido');
  }
  try {
    const items: ItemTextoPdf[] = [];
    for (let numero = 1; numero <= pdf.numPages; numero += 1) {
      const pagina = await pdf.getPage(numero);
      const contenido = await pagina.getTextContent();
      for (const crudo of contenido.items) {
        const item = aItem(crudo as ItemPdfjs, numero);
        if (item) items.push(item);
      }
      pagina.cleanup();
    }
    const lineas = lineasDesdeItems(items);
    if (lineas.every((l) => l.trim() === '')) throw new ErrorLectura('pdf_sin_texto');
    return lineas;
  } catch (error) {
    if (error instanceof ErrorLectura) throw error;
    throw new ErrorLectura('lectura_fallida');
  } finally {
    void tarea.destroy();
  }
}
