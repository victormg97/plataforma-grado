/**
 * Shared types and limits of the cedulario importer (pure TypeScript, no framework).
 *
 * The limits mirror the database / schema limits (`MAX_NIVEL` in `../tree`, `LIMITES` in
 * `../schemas`); a test keeps both in sync. They are duplicated here so the parser has no
 * imports at all and can run anywhere (browser, Node, Web Worker).
 */

export const LIMITES_IMPORTACION = {
  /** Deepest `materias.nivel` allowed by the database. */
  profundidad: 10,
  nombre: 300,
  codigo: 30,
  /** Soft warning threshold: probably two items glued together. */
  nombreLargo: 150,
  /** Maximum number of materias accepted by the `importar_cedulario` RPC. */
  nodos: 5000,
} as const;

/** One item of the review tree. `children` is ordered; `codigo` is the numeric path (`2.1.3`). */
export interface NodoImportacion {
  /** Stable id inside one import session (not a database id). */
  key: string;
  /** Original label as found in the source (`ii.`, `§ I.`, `1)`), null for manually added items. */
  etiqueta: string | null;
  nombre: string;
  codigo: string;
  children: NodoImportacion[];
  /** 1-based line of the source text where the item started (0 = added by hand). */
  lineaOrigen: number;
}

/** Flat form used by the Server Action: parent link by `key`, 1-based `depth`. */
export interface MateriaPlana {
  key: string;
  parentKey: string | null;
  depth: number;
  codigo: string;
  nombre: string;
  etiqueta: string | null;
  lineaOrigen: number;
}

export type SeveridadAdvertencia = 'error' | 'aviso';

export type TipoAdvertencia =
  // Hard errors (block the import)
  | 'sin_estructura'
  | 'profundidad_excedida'
  | 'nombre_vacio'
  | 'nombre_muy_largo'
  | 'codigo_muy_largo'
  | 'codigo_duplicado'
  | 'demasiados_nodos'
  // Soft warnings
  | 'salto_numeracion'
  | 'linea_sin_etiqueta'
  | 'nombre_relleno'
  | 'nombre_largo';

/** A parser finding. UI text is resolved from `tipo` through i18n; `params` are interpolations. */
export interface Advertencia {
  tipo: TipoAdvertencia;
  severidad: SeveridadAdvertencia;
  /** Item the finding is about (absent for global findings). */
  nodoKey?: string;
  /** 1-based source line, when known. */
  linea?: number;
  params?: Record<string, string | number>;
}

export interface UniversidadRef {
  id: string;
  nombre: string;
  codigo?: string | null;
}

export interface MetadatosDetectados {
  nombre: string | null;
  version: string | null;
  /** Raw university name found in the header (for display when nothing matched). */
  universidadTexto: string | null;
  /** Id of the matching entry of the provided university list, if any. */
  universidadId: string | null;
}

export interface ResultadoParseo {
  raiz: NodoImportacion[];
  metadatos: MetadatosDetectados;
  advertencias: Advertencia[];
  /** True when at least one finding is a hard error. */
  hayErrores: boolean;
  totalNodos: number;
  profundidadMaxima: number;
}

export interface OpcionesParseo {
  universidades?: readonly UniversidadRef[];
}

/** Source line after cleaning (`numero` is the 1-based line number in the original text). */
export interface LineaLimpia {
  texto: string;
  numero: number;
}
