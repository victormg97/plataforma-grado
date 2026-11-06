/**
 * Sanitizador de texto enriquecido (TipTap v3 JSON) para el módulo de cedularios.
 *
 * TypeScript puro: sin React ni Supabase. Se ejecuta en el cliente (antes de enviar)
 * y en el servidor (antes de escribir en la base de datos).
 *
 * Reglas:
 * - Solo se conservan los nodos, marcas y atributos de la lista blanca.
 * - Los nodos o marcas fuera de la lista se eliminan, pero el texto de sus
 *   descendientes se conserva.
 * - Los enlaces solo admiten los protocolos de `CAMPOS_ENLACE_PROTOCOLOS`.
 *   Un enlace inválido pierde la marca y conserva el texto.
 * - Las tablas solo existen en la variante `con_tablas` (temario). En la variante
 *   `sin_tablas` (normativa y rúbrica) el texto de las celdas se conserva como párrafos.
 *
 * Propiedades garantizadas:
 * - `sanitizeDoc` es total: nunca lanza y siempre devuelve un documento válido.
 * - Es idempotente: `sanitizeDoc(sanitizeDoc(x))` es igual a `sanitizeDoc(x)`.
 * - Un documento ya válido se devuelve sin cambios (`esDocValido(x)` implica
 *   `sanitizeDoc(x)` igual a `x`).
 *
 * El documento vacío canónico es `{ type: 'doc', content: [{ type: 'paragraph' }] }`,
 * porque el modelo de contenido de TipTap exige al menos un bloque.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export type TiptapDoc = { type: 'doc'; content?: TiptapNode[] };

/** `con_tablas` es la variante del temario; `sin_tablas` la de normativa y rúbrica. */
export type VarianteRichText = 'con_tablas' | 'sin_tablas';

// ---------------------------------------------------------------------------
// Listas blancas
// ---------------------------------------------------------------------------

export const CAMPOS_ENLACE_PROTOCOLOS = ['http:', 'https:', 'mailto:'] as const;

export const NIVELES_ENCABEZADO = [1, 2, 3, 4, 5, 6] as const;

export const NODOS_BASE = [
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
] as const;

export const NODOS_TABLA = ['table', 'tableRow', 'tableHeader', 'tableCell'] as const;

export const MARCAS_PERMITIDAS = ['bold', 'italic', 'underline', 'strike', 'link'] as const;

export const NODOS_PERMITIDOS: Record<VarianteRichText, readonly string[]> = {
  sin_tablas: NODOS_BASE,
  con_tablas: [...NODOS_BASE, ...NODOS_TABLA],
};

// ---------------------------------------------------------------------------
// Límites internos
// ---------------------------------------------------------------------------

/** Profundidad máxima del documento de salida (doc = 0). */
const MAX_PROFUNDIDAD = 40;
/** Máximo de niveles de entrada que se recorren (protege contra ciclos y anidación absurda). */
const MAX_ANIDAMIENTO_ENTRADA = 200;
/** Misma longitud máxima que `enlaceSchema`. */
const MAX_HREF = 2048;

const MARCAS_SET: ReadonlySet<string> = new Set(MARCAS_PERMITIDAS);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function esObjeto(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hijos(n: Obj): unknown[] {
  return Array.isArray(n.content) ? (n.content as unknown[]) : [];
}

function enteroEnRango(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/** Nodo (de cualquier tipo desconocido) que lleva texto propio y no tiene hijos. */
function esTextoPlano(n: Obj): boolean {
  return typeof n.text === 'string' && !Array.isArray(n.content);
}

function tieneCaracteresDeControl(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x20 || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
}

/** Devuelve el href recortado si es una URL absoluta con protocolo permitido; si no, `null`. */
function sanearHref(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const href = v.trim();
  if (href.length === 0 || href.length > MAX_HREF) return null;
  if (tieneCaracteresDeControl(href)) return null;
  try {
    const protocolo = new URL(href).protocol;
    return (CAMPOS_ENLACE_PROTOCOLOS as readonly string[]).includes(protocolo) ? href : null;
  } catch {
    return null;
  }
}

function sanearMarcas(raw: unknown): TiptapMark[] {
  if (!Array.isArray(raw)) return [];
  const vistas = new Set<string>();
  const marcas: TiptapMark[] = [];
  for (let i = 0; i < raw.length; i++) {
    const m: unknown = raw[i];
    if (!esObjeto(m)) continue;
    const tipo = m.type;
    if (typeof tipo !== 'string' || !MARCAS_SET.has(tipo) || vistas.has(tipo)) continue;
    if (tipo === 'link') {
      const attrs = esObjeto(m.attrs) ? m.attrs : null;
      const href = attrs ? sanearHref(attrs.href) : null;
      if (href === null) continue;
      vistas.add(tipo);
      marcas.push({ type: 'link', attrs: { href } });
    } else {
      vistas.add(tipo);
      marcas.push({ type: tipo });
    }
  }
  return marcas;
}

function nodoTexto(texto: string, marcasRaw: unknown): TiptapNode | null {
  if (texto.length === 0) return null;
  const marcas = sanearMarcas(marcasRaw);
  return marcas.length > 0 ? { type: 'text', text: texto, marks: marcas } : { type: 'text', text: texto };
}

// ---------------------------------------------------------------------------
// Contenido en línea (dentro de paragraph y heading)
// ---------------------------------------------------------------------------

function enLinea(items: unknown[]): TiptapNode[] {
  const salida: TiptapNode[] = [];
  const recorrer = (raw: unknown, nivel: number): void => {
    if (nivel > MAX_ANIDAMIENTO_ENTRADA) return;
    if (typeof raw === 'string') {
      const t = nodoTexto(raw, undefined);
      if (t) salida.push(t);
      return;
    }
    if (!esObjeto(raw)) return;
    if (raw.type === 'hardBreak') {
      salida.push({ type: 'hardBreak' });
      return;
    }
    if (esTextoPlano(raw)) {
      const t = nodoTexto(raw.text as string, raw.marks);
      if (t) salida.push(t);
      return;
    }
    // Nodo desconocido o de bloque dentro de contenido en línea: se aplana conservando el texto.
    const lista = hijos(raw);
    for (let i = 0; i < lista.length; i++) recorrer(lista[i], nivel + 1);
  };
  for (let i = 0; i < items.length; i++) recorrer(items[i], 0);
  return salida;
}

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------

function parrafo(contenido: TiptapNode[]): TiptapNode {
  return contenido.length > 0 ? { type: 'paragraph', content: contenido } : { type: 'paragraph' };
}

function itemLista(bloquesItem: TiptapNode[]): TiptapNode {
  // El modelo de TipTap para listItem es `paragraph block*`.
  const primero = bloquesItem[0];
  const contenido =
    primero !== undefined && primero.type === 'paragraph' ? bloquesItem : [{ type: 'paragraph' }, ...bloquesItem];
  return { type: 'listItem', content: contenido };
}

/**
 * Convierte `items` en una lista de nodos de bloque válidos.
 * - `depth`: profundidad que tendrán los nodos creados en esta lista (hijos directos de un nodo con profundidad depth - 1).
 * - `pasos`: nivel de recorrido de la entrada, usado como tope de recursión.
 * - `enDoc`: true solo cuando los bloques cuelgan directamente del documento (único lugar donde se permiten tablas).
 */
function bloques(items: unknown[], enDoc: boolean, depth: number, pasos: number, tablas: boolean): TiptapNode[] {
  const salida: TiptapNode[] = [];
  let tramo: TiptapNode[] = [];

  const cerrarTramo = (): void => {
    if (tramo.length > 0) {
      salida.push({ type: 'paragraph', content: tramo });
      tramo = [];
    }
  };

  const visitar = (raw: unknown, p: number): void => {
    if (p > MAX_ANIDAMIENTO_ENTRADA) return;

    if (typeof raw === 'string') {
      const t = nodoTexto(raw, undefined);
      if (t) tramo.push(t);
      return;
    }
    if (!esObjeto(raw)) return;

    const tipo = raw.type;

    if (tipo === 'hardBreak') {
      tramo.push({ type: 'hardBreak' });
      return;
    }

    if (tipo === 'paragraph' || tipo === 'heading') {
      cerrarTramo();
      const contenido = enLinea(hijos(raw));
      const attrs = esObjeto(raw.attrs) ? raw.attrs : null;
      const nivel = attrs ? attrs.level : undefined;
      if (tipo === 'heading' && enteroEnRango(nivel, 1, 6)) {
        salida.push(
          contenido.length > 0
            ? { type: 'heading', attrs: { level: nivel }, content: contenido }
            : { type: 'heading', attrs: { level: nivel } },
        );
      } else {
        // Un heading con nivel fuera de 1..6 pasa a párrafo y conserva su texto.
        salida.push(parrafo(contenido));
      }
      return;
    }

    if ((tipo === 'bulletList' || tipo === 'orderedList') && depth + 3 <= MAX_PROFUNDIDAD) {
      cerrarTramo();
      const lista = construirLista(raw, tipo, depth, p, tablas);
      if (lista) salida.push(lista);
      return;
    }

    if (tipo === 'table' && tablas && enDoc && depth + 4 <= MAX_PROFUNDIDAD) {
      cerrarTramo();
      salida.push(...construirTabla(raw, depth, p));
      return;
    }

    if (esTextoPlano(raw)) {
      const t = nodoTexto(raw.text as string, raw.marks);
      if (t) tramo.push(t);
      return;
    }

    // Nodo desconocido o no permitido en este contexto: se aplana conservando el texto.
    const lista = hijos(raw);
    if (lista.length > 0) {
      cerrarTramo();
      for (let i = 0; i < lista.length; i++) visitar(lista[i], p + 1);
      cerrarTramo();
    }
  };

  for (let i = 0; i < items.length; i++) visitar(items[i], pasos);
  cerrarTramo();
  return salida;
}

function construirLista(
  raw: Obj,
  tipo: 'bulletList' | 'orderedList',
  depth: number,
  p: number,
  tablas: boolean,
): TiptapNode | null {
  const items: TiptapNode[] = [];
  let sueltos: unknown[] = [];

  const cerrarSueltos = (): void => {
    if (sueltos.length === 0) return;
    const b = bloques(sueltos, false, depth + 2, p + 1, tablas);
    sueltos = [];
    if (b.length > 0) items.push(itemLista(b));
  };

  const lista = hijos(raw);
  for (let i = 0; i < lista.length; i++) {
    const hijo = lista[i];
    if (esObjeto(hijo) && hijo.type === 'listItem') {
      cerrarSueltos();
      items.push(itemLista(bloques(hijos(hijo), false, depth + 2, p + 2, tablas)));
    } else {
      sueltos.push(hijo);
    }
  }
  cerrarSueltos();

  if (items.length === 0) return null;

  const nodo: TiptapNode = { type: tipo, content: items };
  if (tipo === 'orderedList' && esObjeto(raw.attrs) && enteroEnRango(raw.attrs.start, 1, 1_000_000_000)) {
    nodo.attrs = { start: raw.attrs.start };
  }
  return nodo;
}

function construirCelda(raw: Obj, tipo: 'tableCell' | 'tableHeader', depth: number, p: number): TiptapNode {
  // `depth` es la profundidad de la celda; sus bloques viven un nivel más abajo.
  const b = bloques(hijos(raw), false, depth + 1, p + 1, true);
  const nodo: TiptapNode = { type: tipo, content: b.length > 0 ? b : [{ type: 'paragraph' }] };

  if (esObjeto(raw.attrs)) {
    const attrs: Record<string, unknown> = {};
    const colspan = enteroEnRango(raw.attrs.colspan, 1, 1000) ? raw.attrs.colspan : undefined;
    const rowspan = enteroEnRango(raw.attrs.rowspan, 1, 1000) ? raw.attrs.rowspan : undefined;
    if (colspan !== undefined) attrs.colspan = colspan;
    if (rowspan !== undefined) attrs.rowspan = rowspan;

    const ancho = raw.attrs.colwidth;
    if (
      Array.isArray(ancho) &&
      ancho.length === (colspan ?? 1) &&
      ancho.every((w: unknown) => enteroEnRango(w, 0, 10_000))
    ) {
      attrs.colwidth = ancho.map((w: unknown) => w as number);
    }

    if (Object.keys(attrs).length > 0) nodo.attrs = attrs;
  }
  return nodo;
}

function construirFila(raw: Obj, depth: number, p: number): TiptapNode | null {
  // `depth` es la profundidad de la fila; sus celdas viven un nivel más abajo.
  const celdas: TiptapNode[] = [];
  let sueltos: unknown[] = [];

  const cerrarSueltos = (): void => {
    if (sueltos.length === 0) return;
    const b = bloques(sueltos, false, depth + 2, p + 1, true);
    sueltos = [];
    if (b.length > 0) celdas.push({ type: 'tableCell', content: b });
  };

  const lista = hijos(raw);
  for (let i = 0; i < lista.length; i++) {
    const hijo = lista[i];
    if (esObjeto(hijo) && (hijo.type === 'tableCell' || hijo.type === 'tableHeader')) {
      cerrarSueltos();
      celdas.push(construirCelda(hijo, hijo.type, depth + 1, p + 2));
    } else {
      sueltos.push(hijo);
    }
  }
  cerrarSueltos();

  return celdas.length > 0 ? { type: 'tableRow', content: celdas } : null;
}

/**
 * Devuelve los bloques que reemplazan a una tabla: normalmente una tabla, más los
 * bloques con el texto de cualquier hijo que no sea una fila (para no perderlo).
 */
function construirTabla(raw: Obj, depth: number, p: number): TiptapNode[] {
  const salida: TiptapNode[] = [];
  let filas: TiptapNode[] = [];
  let sueltos: unknown[] = [];

  const cerrarFilas = (): void => {
    if (filas.length > 0) {
      salida.push({ type: 'table', content: filas });
      filas = [];
    }
  };
  const cerrarSueltos = (): void => {
    if (sueltos.length > 0) {
      salida.push(...bloques(sueltos, false, depth, p + 1, true));
      sueltos = [];
    }
  };

  const lista = hijos(raw);
  for (let i = 0; i < lista.length; i++) {
    const hijo = lista[i];
    if (esObjeto(hijo) && hijo.type === 'tableRow') {
      cerrarSueltos();
      const fila = construirFila(hijo, depth + 1, p + 2);
      if (fila) filas.push(fila);
    } else {
      cerrarFilas();
      sueltos.push(hijo);
    }
  }
  cerrarFilas();
  cerrarSueltos();
  return salida;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function docVacio(): TiptapDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/**
 * Función total: acepta cualquier valor, nunca lanza y siempre devuelve un documento válido.
 * Elimina nodos, marcas, atributos y enlaces fuera de la lista blanca conservando el texto.
 *
 * @param variante `con_tablas` (por defecto, temario) o `sin_tablas` (normativa y rúbrica).
 */
export function sanitizeDoc(input: unknown, variante: VarianteRichText = 'con_tablas'): TiptapDoc {
  try {
    const tablas = variante === 'con_tablas';
    let items: unknown[];
    if (esObjeto(input) && input.type === 'doc') items = hijos(input);
    else if (Array.isArray(input)) items = input as unknown[];
    else items = [input];

    const contenido = bloques(items, true, 1, 0, tablas);
    return { type: 'doc', content: contenido.length > 0 ? contenido : [{ type: 'paragraph' }] };
  } catch {
    return docVacio();
  }
}

function igualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!igualJson(a[i], b[i])) return false;
    return true;
  }
  if (esObjeto(a)) {
    if (!esObjeto(b)) return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) {
      if (!Object.prototype.hasOwnProperty.call(b, k) || !igualJson(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Un documento es válido cuando ya está en forma canónica: `sanitizeDoc` lo devuelve sin cambios.
 * Esto garantiza que `esDocValido` y `sanitizeDoc` nunca discrepen.
 */
export function esDocValido(input: unknown, variante: VarianteRichText = 'con_tablas'): input is TiptapDoc {
  try {
    return esObjeto(input) && input.type === 'doc' && igualJson(sanitizeDoc(input, variante), input);
  } catch {
    return false;
  }
}
