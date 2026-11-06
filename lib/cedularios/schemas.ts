/**
 * Validation schemas (Zod v4) and logo validation for the cedularios module.
 *
 * Pure TypeScript: no React, no Supabase client. The same schemas run in the
 * browser (react-hook-form resolvers) and in Server Actions.
 *
 * Every message is an i18n key relative to the `cedularios.errores` namespace,
 * never literal text, so forms can translate it with
 * `t('errores.' + message)` (Req 15.1). Keys that are also a `CedularioErrorCode`
 * (`url_invalida`, `logo_formato_invalido`, `logo_muy_grande`) resolve to the
 * messages required by Req 17.6. The remaining field-specific keys are listed in
 * `CLAVES_VALIDACION` so the `errores.*` block of `messages/*.json` can define them.
 *
 * Trimmed text fields (`nombre`, `codigo`, `titulo`, `url`) are trimmed first, and
 * the length limits apply to the trimmed value. `descripcion` and `version` are
 * validated as typed.
 */

import { z } from 'zod';

import type { CedularioErrorCode } from './errors';
import { esDocValido, type TiptapDoc, type VarianteRichText } from './richtext';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const LIMITES = {
  universidadNombre: 120,
  universidadCodigo: 20,
  cedularioNombre: 200,
  cedularioVersion: 50,
  cedularioDescripcion: 2000,
  materiaCodigo: 30,
  materiaNombre: 300,
  materiaDescripcion: 2000,
  enlaceUrl: 2048,
  enlaceTitulo: 200,
  enlaceDescripcion: 500,
  /** Serialized (UTF-8 JSON) size of a rich-text document. */
  tiptapBytes: 200_000,
  historialTabla: 64,
} as const;

// ---------------------------------------------------------------------------
// Error keys (relative to `cedularios.errores`)
// ---------------------------------------------------------------------------

/**
 * Field-specific validation keys. Keys that match a `CedularioErrorCode`
 * (`url_invalida`) already exist in the error catalog; the others must be added
 * to `cedularios.errores` in the message files.
 */
export const CLAVES_VALIDACION = [
  'nombre_requerido',
  'nombre_muy_largo',
  'codigo_requerido',
  'codigo_muy_largo',
  'version_muy_larga',
  'descripcion_muy_larga',
  'titulo_requerido',
  'titulo_muy_largo',
  'universidad_invalida',
  'materia_padre_invalida',
  'url_invalida',
  'contenido_invalido',
  'contenido_muy_grande',
  'tabla_invalida',
  'usuario_invalido',
  'fecha_invalida',
  'rango_fechas_invalido',
] as const;

export type ClaveValidacion = (typeof CLAVES_VALIDACION)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trimmed string of `1..max` characters (after trimming). */
function textoRequerido(max: number, requerido: ClaveValidacion, muyLargo: ClaveValidacion) {
  return z.string({ error: requerido }).trim().min(1, requerido).max(max, muyLargo);
}

/** Untrimmed string of at most `max` characters. */
function textoOpcional(max: number, muyLargo: ClaveValidacion) {
  return z.string({ error: muyLargo }).max(max, muyLargo).optional();
}

/** Any 8-4-4-4-12 hex id (not restricted to RFC versions, so seeded ids are accepted). */
function idUuid(clave: ClaveValidacion) {
  return z.guid({ error: clave });
}

// ---------------------------------------------------------------------------
// Universidad, cedulario, materia
// ---------------------------------------------------------------------------

export const universidadSchema = z.object({
  nombre: textoRequerido(LIMITES.universidadNombre, 'nombre_requerido', 'nombre_muy_largo'),
  codigo: textoRequerido(LIMITES.universidadCodigo, 'codigo_requerido', 'codigo_muy_largo'),
});

export const cedularioSchema = z.object({
  universidad_id: idUuid('universidad_invalida'),
  nombre: textoRequerido(LIMITES.cedularioNombre, 'nombre_requerido', 'nombre_muy_largo'),
  version: textoOpcional(LIMITES.cedularioVersion, 'version_muy_larga'),
  descripcion: textoOpcional(LIMITES.cedularioDescripcion, 'descripcion_muy_larga'),
});

export const materiaSchema = z.object({
  codigo: textoRequerido(LIMITES.materiaCodigo, 'codigo_requerido', 'codigo_muy_largo'),
  nombre: textoRequerido(LIMITES.materiaNombre, 'nombre_requerido', 'nombre_muy_largo'),
  descripcion: textoOpcional(LIMITES.materiaDescripcion, 'descripcion_muy_larga'),
  parent_id: idUuid('materia_padre_invalida').nullable(),
});

// ---------------------------------------------------------------------------
// Enlace
// ---------------------------------------------------------------------------

const PROTOCOLOS_ENLACE: readonly string[] = ['http:', 'https:'];

function esUrlAbsolutaHttp(valor: string): boolean {
  try {
    return PROTOCOLOS_ENLACE.includes(new URL(valor).protocol);
  } catch {
    return false;
  }
}

export const enlaceSchema = z.object({
  url: z
    .string({ error: 'url_invalida' })
    .trim()
    .min(1, 'url_invalida')
    .max(LIMITES.enlaceUrl, 'url_invalida')
    .refine(esUrlAbsolutaHttp, { error: 'url_invalida' }),
  titulo: textoRequerido(LIMITES.enlaceTitulo, 'titulo_requerido', 'titulo_muy_largo'),
  descripcion: textoOpcional(LIMITES.enlaceDescripcion, 'descripcion_muy_larga'),
});

// ---------------------------------------------------------------------------
// Rich text
// ---------------------------------------------------------------------------

const codificador = new TextEncoder();

/** UTF-8 size of the JSON serialization, or `null` when it cannot be serialized (cycles, BigInt). */
function bytesSerializados(valor: unknown): number | null {
  try {
    const json = JSON.stringify(valor);
    return json === undefined ? null : codificador.encode(json).length;
  } catch {
    return null;
  }
}

/**
 * Schema for a TipTap document of the given variant: `con_tablas` for the temario,
 * `sin_tablas` for normativa and rúbrica. Delegates the structural check to
 * `esDocValido` and rejects documents over 200 000 serialized bytes.
 */
export function crearTiptapDocSchema(variante: VarianteRichText = 'con_tablas') {
  return z.custom<TiptapDoc>().superRefine((valor, ctx) => {
    const bytes = bytesSerializados(valor);
    if (bytes === null) {
      ctx.addIssue({ code: 'custom', message: 'contenido_invalido' });
      return;
    }
    if (bytes > LIMITES.tiptapBytes) {
      ctx.addIssue({ code: 'custom', message: 'contenido_muy_grande' });
      return;
    }
    if (!esDocValido(valor, variante)) {
      ctx.addIssue({ code: 'custom', message: 'contenido_invalido' });
    }
  });
}

/** Temario (tables allowed). */
export const tiptapDocSchema = crearTiptapDocSchema('con_tablas');
/** Normativa and rúbrica (no tables). */
export const tiptapDocSinTablasSchema = crearTiptapDocSchema('sin_tablas');

// ---------------------------------------------------------------------------
// Historial filters
// ---------------------------------------------------------------------------

function marcaDeTiempo(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  const t = Date.parse(valor);
  return Number.isNaN(t) ? null : t;
}

const fechaFiltro = z
  .string({ error: 'fecha_invalida' })
  .refine((v) => marcaDeTiempo(v) !== null, { error: 'fecha_invalida' })
  .optional();

export const historialFiltrosSchema = z
  .object({
    tabla: z
      .string({ error: 'tabla_invalida' })
      .max(LIMITES.historialTabla, 'tabla_invalida')
      .regex(/^[a-z][a-z0-9_]*$/, 'tabla_invalida')
      .optional(),
    usuario_id: idUuid('usuario_invalido').optional(),
    desde: fechaFiltro,
    hasta: fechaFiltro,
  })
  .refine(
    (f) => {
      const desde = marcaDeTiempo(f.desde);
      const hasta = marcaDeTiempo(f.hasta);
      return desde === null || hasta === null || desde <= hasta;
    },
    { error: 'rango_fechas_invalido', path: ['hasta'] },
  );

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type UniversidadInput = z.input<typeof universidadSchema>;
export type CedularioInput = z.input<typeof cedularioSchema>;
export type MateriaInput = z.input<typeof materiaSchema>;
export type EnlaceInput = z.input<typeof enlaceSchema>;
export type HistorialFiltrosInput = z.input<typeof historialFiltrosSchema>;

export type UniversidadData = z.output<typeof universidadSchema>;
export type CedularioData = z.output<typeof cedularioSchema>;
export type MateriaData = z.output<typeof materiaSchema>;
export type EnlaceData = z.output<typeof enlaceSchema>;
export type HistorialFiltrosData = z.output<typeof historialFiltrosSchema>;

// ---------------------------------------------------------------------------
// Logo validation (Req 1.3, 1.4)
// ---------------------------------------------------------------------------

/** Allow-list: PNG, JPEG, WEBP, GIF, AVIF, SVG. Matches the `cedularios-logos` bucket. */
export const LOGO_MIME_PERMITIDOS = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
] as const;

export type LogoMime = (typeof LOGO_MIME_PERMITIDOS)[number];

/** File extension used in the storage path for each allowed MIME type. */
export const LOGO_EXTENSION_POR_MIME: Readonly<Record<LogoMime, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/** 2 MB. */
export const LOGO_MAX_BYTES = 2_097_152;

export type LogoErrorCode = Extract<CedularioErrorCode, 'logo_formato_invalido' | 'logo_muy_grande'>;

export type ResultadoLogo = { ok: true } | { ok: false; code: LogoErrorCode };

/** Checks the MIME type first, then the size (`size` in bytes; exactly 2 MB is accepted). */
export function validarLogo(archivo: { type: string; size: number }): ResultadoLogo {
  const tipo = typeof archivo.type === 'string' ? archivo.type.trim().toLowerCase() : '';
  if (!(LOGO_MIME_PERMITIDOS as readonly string[]).includes(tipo)) {
    return { ok: false, code: 'logo_formato_invalido' };
  }
  if (typeof archivo.size !== 'number' || Number.isNaN(archivo.size) || archivo.size < 0) {
    return { ok: false, code: 'logo_formato_invalido' };
  }
  if (archivo.size > LOGO_MAX_BYTES) {
    return { ok: false, code: 'logo_muy_grande' };
  }
  return { ok: true };
}
