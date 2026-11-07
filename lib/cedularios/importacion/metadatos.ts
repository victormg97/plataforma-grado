/**
 * Header metadata detection (nombre, version, universidad). Pure and deterministic.
 *
 * Works on the lines before the first label (`prefacio`) and, for the university only, on the
 * start of the raw text too, because some converters put the letterhead inside an HTML comment
 * that cleaning removes.
 */

import { limpiarLinea, quitarMarcaViñeta } from './limpieza';
import type { LineaLimpia, MetadatosDetectados, UniversidadRef } from './tipos';

const PALABRAS_MENORES = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'para', 'a', 'o', 'u', 'por', 'al', 'con',
]);

const TITULO = /\b(temario|cedulario|programa|c[eé]dula)\b/i;
const FECHA_LARGA = /\b\d{1,2}\s+de\s+[a-zñáéíóú]+\s+de\s+(?:19|20)\d{2}\b/i;
const ANIO = /\b(?:19|20)\d{2}\b/;
const UNIVERSIDAD = /universidad\s+.+?(?=\s+facultad\b|\s+escuela\b|\s+departamento\b|\s+\d|<br|\n|$)/i;

/** Lower-case, accent-free, single-spaced form used to compare names. */
export function normalizarComparacion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** `TEMARIO DE DERECHO CIVIL` -> `Temario de Derecho Civil`; mixed-case input is kept. */
function aTitulo(texto: string): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (t === '' || t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && PALABRAS_MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** True when the text stops on a connector ("CEDULARIO DE"): the title goes on in the next line. */
function terminaEnConector(texto: string): boolean {
  const ultima = texto.trim().split(/\s+/).pop() ?? '';
  return PALABRAS_MENORES.has(ultima.toLowerCase());
}

function detectarNombre(prefacio: readonly LineaLimpia[]): string | null {
  const noUniversidad = (l: LineaLimpia) => !/universidad/i.test(l.texto);
  const indice = prefacio.findIndex((l) => TITULO.test(l.texto) && noUniversidad(l));
  const inicio = indice >= 0 ? indice : prefacio.findIndex(noUniversidad);
  if (inicio < 0) return null;
  // A title split over two or three lines ("CEDULARIO DE" / "DERECHO PROCESAL").
  let texto = prefacio[inicio].texto;
  for (let i = inicio + 1; i < prefacio.length && i <= inicio + 2 && terminaEnConector(texto); i += 1) {
    if (!noUniversidad(prefacio[i])) break;
    texto = `${texto} ${prefacio[i].texto}`;
  }
  const nombre = aTitulo(texto);
  return nombre === '' ? null : nombre;
}

function detectarVersion(prefacio: readonly LineaLimpia[]): string | null {
  const texto = prefacio.map((l) => l.texto).join('\n');
  const larga = FECHA_LARGA.exec(texto);
  if (larga) return larga[0].toUpperCase();
  const anio = ANIO.exec(texto);
  return anio ? anio[0] : null;
}

function coincideUniversidad(textoNormalizado: string, u: UniversidadRef): boolean {
  const nombre = normalizarComparacion(u.nombre);
  if (nombre !== '' && textoNormalizado.includes(nombre)) return true;
  const codigo = u.codigo ? normalizarComparacion(u.codigo) : '';
  return codigo !== '' && ` ${textoNormalizado} `.includes(` ${codigo} `);
}

/**
 * @param textoCrudo  the original text (only its first 4000 characters are inspected)
 * @param prefacio    cleaned lines before the first label
 * @param universidades  known universities to match against (optional)
 */
export function detectarMetadatos(
  textoCrudo: string,
  prefacio: readonly LineaLimpia[],
  universidades: readonly UniversidadRef[] = [],
): MetadatosDetectados {
  const cabecera = textoCrudo.slice(0, 4000);
  const cabeceraPlana = cabecera
    .split('\n')
    .map((l) => quitarMarcaViñeta(limpiarLinea(l)))
    .join('\n');
  // Letterhead text inside comments / <br> chains: compare against the de-tagged raw head.
  const plano = cabecera.replace(/<!--|-->/g, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
  const comparable = normalizarComparacion(`${plano}\n${cabeceraPlana}`);

  const coincidencia = universidades.find((u) => coincideUniversidad(comparable, u)) ?? null;
  const textoUniversidad = UNIVERSIDAD.exec(plano.replace(/\*\*|\\/g, '')) ?? UNIVERSIDAD.exec(cabeceraPlana);

  return {
    nombre: detectarNombre(prefacio),
    version: detectarVersion(prefacio),
    universidadTexto: textoUniversidad ? textoUniversidad[0].replace(/\s+/g, ' ').trim() : null,
    universidadId: coincidencia ? coincidencia.id : null,
  };
}
