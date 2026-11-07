/**
 * Public entry point of the cedulario importer parser. Pure and deterministic: the same text
 * always yields the same tree. No LLM, no network, no framework imports.
 */

import { aplanarArbol, construirArbol, profundidadMaxima, recalcularCodigos } from './arbol';
import { hayErrores, validarArbol } from './advertencias';
import { limpiarTexto } from './limpieza';
import { detectarMetadatos } from './metadatos';
import type { Advertencia, OpcionesParseo, ResultadoParseo } from './tipos';

/** Parses the text of a converted cedulario (markdown or plain text). Never throws. */
export function parsearTexto(texto: string, opciones: OpcionesParseo = {}): ResultadoParseo {
  const lineas = limpiarTexto(texto);
  const { raiz, advertencias, prefacio } = construirArbol(lineas);
  const metadatos = detectarMetadatos(texto, prefacio, opciones.universidades ?? []);
  const todas: Advertencia[] = [...validarArbol(raiz), ...advertencias];
  return {
    raiz,
    metadatos,
    advertencias: todas,
    hayErrores: hayErrores(todas),
    totalNodos: aplanarArbol(raiz).length,
    profundidadMaxima: profundidadMaxima(raiz),
  };
}

/** Same as `parsearTexto` for text that is already split into lines (for example from a PDF). */
export function parsearLineas(lineas: readonly string[], opciones: OpcionesParseo = {}): ResultadoParseo {
  return parsearTexto(lineas.join('\n'), opciones);
}

export { aplanarArbol, hayErrores, profundidadMaxima, recalcularCodigos, validarArbol };
export { lineasDesdeItems, type ItemTextoPdf } from './pdf-lineas';
export * from './tipos';
