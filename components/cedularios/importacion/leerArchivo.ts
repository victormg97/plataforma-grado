import { ErrorLectura, extraerLineasPdf } from './extraerPdf';

export type FormatoArchivo = 'pdf' | 'md' | 'txt';

export const TAMANO_MAXIMO_BYTES = 25 * 1024 * 1024;
export const ACEPTA_ARCHIVOS = '.pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain';

export interface ArchivoLeido {
  nombreArchivo: string;
  formato: FormatoArchivo;
  /** Text to parse (PDF lines joined with line breaks). */
  texto: string;
}

export function formatoDe(archivo: Pick<File, 'name' | 'type'>): FormatoArchivo | null {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith('.pdf') || archivo.type === 'application/pdf') return 'pdf';
  if (nombre.endsWith('.md') || nombre.endsWith('.markdown') || archivo.type === 'text/markdown') return 'md';
  if (nombre.endsWith('.txt') || archivo.type === 'text/plain') return 'txt';
  return null;
}

/** Reads a `.pdf`, `.md` or `.txt` file in the browser. Throws `ErrorLectura`. */
export async function leerArchivo(archivo: File): Promise<ArchivoLeido> {
  const formato = formatoDe(archivo);
  if (formato === null) throw new ErrorLectura('formato_no_soportado');
  if (archivo.size === 0) throw new ErrorLectura('archivo_vacio');
  if (archivo.size > TAMANO_MAXIMO_BYTES) throw new ErrorLectura('archivo_muy_grande');
  if (formato === 'pdf') {
    const lineas = await extraerLineasPdf(archivo);
    return { nombreArchivo: archivo.name, formato, texto: lineas.join('\n') };
  }
  try {
    const texto = await archivo.text();
    if (texto.trim() === '') throw new ErrorLectura('archivo_vacio');
    return { nombreArchivo: archivo.name, formato, texto };
  } catch (error) {
    if (error instanceof ErrorLectura) throw error;
    throw new ErrorLectura('lectura_fallida');
  }
}
