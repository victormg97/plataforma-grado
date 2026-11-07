/**
 * Label detection for the cedulario importer. Pure and deterministic.
 *
 * Label families found in Chilean law-school cedularios:
 * - `seccion`            `§ I.`
 * - `romano-mayus`       `I.-`, `XIV.`
 * - `numero-punto`       `1.`, `12.` (also a bare `1 ` at the start of a line)
 * - `numero-parentesis`  `1)`
 * - `letra`              `a.`, `a)`, `(a)`
 * - `romano-min`         `i.`, `iv)`
 *
 * A single lowercase letter such as `i`, `v`, `x`, `c`, `d`, `l`, `m` is ambiguous (letter
 * number 9 or roman numeral 1). the detection functions return every reading as a candidate; the tree
 * builder picks the one that continues the sequence it is in (`h.` -> `i.` is a letter,
 * `iv.` -> `v.` is a roman numeral).
 */

export type FamiliaEtiqueta =
  | 'seccion'
  | 'romano-mayus'
  | 'numero-punto'
  | 'numero-parentesis'
  | 'letra'
  | 'romano-min';

export interface CandidatoEtiqueta {
  familia: FamiliaEtiqueta;
  valor: number;
}

export interface EtiquetaDetectada {
  /** Index of the first character of the label. */
  inicio: number;
  /** Index of the first character after the label and the spaces that follow it. */
  fin: number;
  /** The label as written (`ii.`, `§ I.`). */
  texto: string;
  candidatos: CandidatoEtiqueta[];
}

const VALORES_ROMANOS: Readonly<Record<string, number>> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
};

const ROMANO_VALIDO = /^m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;

/** Parses a roman numeral (any case). Returns null for empty or malformed input. */
export function parsearRomano(texto: string): number | null {
  const t = texto.toLowerCase();
  if (t === '' || !ROMANO_VALIDO.test(t)) return null;
  let total = 0;
  for (let i = 0; i < t.length; i += 1) {
    const actual = VALORES_ROMANOS[t[i]];
    const siguiente = i + 1 < t.length ? VALORES_ROMANOS[t[i + 1]] : 0;
    total += actual < siguiente ? -actual : actual;
  }
  return total;
}

// One alternative per label shape. Labels must start after whitespace (or at the beginning) and
// end before whitespace (or at the end of the text).
//  1: §-section roman      2: uppercase roman with ".-"   3: uppercase roman with "."
//  4,5: number + . or )    6: (a)                         7,8: single letter + . or )
//  9,10: 2+ roman letters + . or )
const PATRON_ETIQUETA =
  /(?<!\S)(?:§\s*([IVXLCDM]+)(?:\.-?)?|([IVXLCDM]+)\.-|([IVXLCDM]+)\.|(\d{1,2})([.)])-?|\(([a-z])\)|([a-z])([.)])|([ivxlcdm]{2,})([.)]))(?=\s|$)/g;

/** Bare number at the start of a line followed by an uppercase word: `1 El proceso`. */
const NUMERO_SIN_PUNTO = /^(\d{1,2})\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/;

/** `23 DE DICIEMBRE DE 2025`: a date in the header, not item number 23. */
const FECHA_AL_INICIO = /^\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i;

const SOLO_ROMANAS = /^[ivxlcdm]$/;

function candidatosDe(m: RegExpExecArray): CandidatoEtiqueta[] {
  const [, seccion, mayusGuion, mayus, numero, delimitador, letraParen, letra, , romanoMulti] = m;
  const candidatos: CandidatoEtiqueta[] = [];

  const agregarRomano = (familia: FamiliaEtiqueta, texto: string | undefined) => {
    const valor = texto === undefined ? null : parsearRomano(texto);
    if (valor !== null) candidatos.push({ familia, valor });
  };

  if (seccion !== undefined) agregarRomano('seccion', seccion);
  else if (mayusGuion !== undefined) agregarRomano('romano-mayus', mayusGuion);
  else if (mayus !== undefined) agregarRomano('romano-mayus', mayus);
  else if (numero !== undefined) {
    candidatos.push({
      familia: delimitador === ')' ? 'numero-parentesis' : 'numero-punto',
      valor: parseInt(numero, 10),
    });
  } else if (letraParen !== undefined || letra !== undefined) {
    const l = (letraParen ?? letra) as string;
    candidatos.push({ familia: 'letra', valor: l.charCodeAt(0) - 96 });
    if (SOLO_ROMANAS.test(l)) agregarRomano('romano-min', l);
  } else if (romanoMulti !== undefined) {
    agregarRomano('romano-min', romanoMulti);
  }
  return candidatos;
}

function desdeMatch(texto: string, m: RegExpExecArray): EtiquetaDetectada | null {
  const candidatos = candidatosDe(m);
  if (candidatos.length === 0) return null;
  let fin = m.index + m[0].length;
  while (fin < texto.length && texto[fin] === ' ') fin += 1;
  return { inicio: m.index, fin, texto: m[0].trim(), candidatos };
}

/**
 * Finds the first label that starts at or after `desde`. Labels that cannot be read (for
 * example `MMMM.`) are skipped. Returns null when there is none.
 */
export function siguienteEtiqueta(texto: string, desde: number): EtiquetaDetectada | null {
  const re = new RegExp(PATRON_ETIQUETA.source, 'g');
  re.lastIndex = Math.max(0, desde);
  for (;;) {
    const m = re.exec(texto);
    if (m === null) return null;
    const detectada = desdeMatch(texto, m);
    if (detectada !== null) return detectada;
    if (m[0].length === 0) re.lastIndex += 1;
  }
}

/** Label at the very beginning of a (cleaned) line, or null. */
export function etiquetaAlInicio(linea: string): EtiquetaDetectada | null {
  const sinPunto = NUMERO_SIN_PUNTO.exec(linea);
  const conPunto = siguienteEtiqueta(linea, 0);
  if (conPunto !== null && conPunto.inicio === 0) return conPunto;
  if (sinPunto !== null && !FECHA_AL_INICIO.test(linea)) {
    return {
      inicio: 0,
      fin: sinPunto[0].length,
      texto: sinPunto[1],
      candidatos: [{ familia: 'numero-punto', valor: parseInt(sinPunto[1], 10) }],
    };
  }
  return null;
}
