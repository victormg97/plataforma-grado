/**
 * Error codes and database error mapping for the cedularios module.
 *
 * Pure TypeScript: no React, no Supabase client. Every code in
 * `CedularioErrorCode` is also the last segment of its i18n key, so the
 * message for a code lives at `cedularios.errores.<code>` (Req 17.6).
 */

import type { ActionError } from './action-result';

export const CEDULARIO_ERROR_CODES = [
  // Tree rules (CD001-CD003)
  'nivel_maximo',
  'ciclo',
  'padre_invalido',
  // Business guards (CD004-CD009)
  'universidad_con_cedularios',
  'colaborador_no_profesor',
  'colaborador_es_creador',
  'solo_creador_o_admin',
  'cedulario_con_asignaciones',
  'lista_desactualizada',
  // Student tracking guards (CD010-CD016, phase 2)
  'asignacion_duplicada',
  'alumno_no_valido',
  'asignacion_inactiva',
  'clase_otro_alumno',
  'materia_invalida',
  'fecha_futura',
  'cedulario_no_disponible',
  // Import (migration 155)
  'cedulario_no_vacio',
  // Unique violations
  'codigo_universidad_duplicado',
  'codigo_duplicado_nivel',
  'permiso_duplicado',
  // Validation
  'validacion',
  'url_invalida',
  'logo_formato_invalido',
  'logo_muy_grande',
  // Access, connectivity and fallback
  'sin_permisos',
  'error_conexion',
  'error_generico',
] as const;

export type CedularioErrorCode = (typeof CEDULARIO_ERROR_CODES)[number];

/** Client-side limit for an action or query before it is reported as a connection error (Req 15.4). */
export const TIMEOUT_OPERACION_MS = 30_000;

/** i18n namespace used by the module. */
export const CEDULARIOS_I18N_NAMESPACE = 'cedularios';

/** Key relative to the `cedularios` namespace, for `useTranslations('cedularios')`. */
export function errorI18nKey(code: CedularioErrorCode): `errores.${CedularioErrorCode}` {
  return `errores.${code}`;
}

/** Fully qualified key, `cedularios.errores.<code>`. */
export function errorI18nKeyCompleta(code: CedularioErrorCode): `cedularios.errores.${CedularioErrorCode}` {
  return `cedularios.errores.${code}`;
}

export function esCodigoDeError(valor: unknown): valor is CedularioErrorCode {
  return typeof valor === 'string' && (CEDULARIO_ERROR_CODES as readonly string[]).includes(valor);
}

/** Context that refines the mapping. All fields are optional. */
export interface MapDbErrorContext {
  /** The operation was an update/delete that affected zero rows (RLS filtered it, or the record is gone). */
  zeroRows?: boolean;
  /** The client-side timeout fired before the operation answered. */
  timeout?: boolean;
  /** Extra interpolation params copied to the resulting `ActionError` by `toActionError`. */
  params?: Record<string, string | number>;
  /** Check constraint name (or fragment) to form field name, used by `toActionError` for `23514`. */
  camposPorConstraint?: Record<string, string>;
}

/** SQLSTATEs raised by the guard triggers and RPCs (migration 152). */
const CODIGO_POR_SQLSTATE: Readonly<Record<string, CedularioErrorCode>> = {
  CD001: 'nivel_maximo',
  CD002: 'ciclo',
  CD003: 'padre_invalido',
  CD004: 'universidad_con_cedularios',
  CD005: 'colaborador_no_profesor',
  CD006: 'colaborador_es_creador',
  CD007: 'solo_creador_o_admin',
  CD008: 'cedulario_con_asignaciones',
  CD009: 'lista_desactualizada',
  // Student tracking (migration 154)
  CD010: 'asignacion_duplicada',
  CD011: 'alumno_no_valido',
  CD012: 'asignacion_inactiva',
  CD013: 'clase_otro_alumno',
  CD014: 'materia_invalida',
  CD015: 'fecha_futura',
  CD016: 'cedulario_no_disponible',
  // Import (migration 155)
  CD017: 'cedulario_no_vacio',
  '23514': 'validacion',
  '42501': 'sin_permisos',
  // PostgREST: missing, invalid or expired JWT.
  PGRST301: 'sin_permisos',
  PGRST302: 'sin_permisos',
  // statement_timeout: the server did not answer in time.
  '57014': 'error_conexion',
};

/** Unique-violation (`23505`) constraint or index names. */
const CODIGO_POR_CONSTRAINT_UNICA: ReadonlyArray<readonly [string, CedularioErrorCode]> = [
  ['uq_universidades_codigo', 'codigo_universidad_duplicado'],
  ['uq_materias_codigo_hermanos', 'codigo_duplicado_nivel'],
  ['uq_cedulario_profesores', 'permiso_duplicado'],
  ['uq_cedulario_asignaciones', 'asignacion_duplicada'],
];

const PATRON_RED =
  /fetch failed|failed to fetch|networkerror|network request failed|network error|load failed|timeout|timed out|econnreset|econnrefused|enotfound|etimedout|eai_again|socket hang up|und_err|aborted/i;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function esErrorDeRed(error: Record<string, unknown>): boolean {
  if (error instanceof TypeError) return true;
  const nombre = textoDe(error.name);
  if (nombre === 'AbortError' || nombre === 'TimeoutError') return true;
  const causa = error.cause;
  if (esObjeto(causa) && PATRON_RED.test(`${textoDe(causa.code)} ${textoDe(causa.message)}`)) return true;
  return PATRON_RED.test(`${textoDe(error.message)} ${textoDe(error.code)}`);
}

/**
 * Reads the integer carried in the `details` field (Postgres DETAIL) of a CD008 error.
 * Returns `undefined` when it is missing or is not a non-negative integer.
 */
export function leerConteoDeDetalles(error: unknown): number | undefined {
  if (!esObjeto(error)) return undefined;
  const detalle = error.details;
  if (typeof detalle === 'number') {
    return Number.isSafeInteger(detalle) && detalle >= 0 ? detalle : undefined;
  }
  if (typeof detalle !== 'string' || !/^\s*\d+\s*$/.test(detalle)) return undefined;
  const numero = Number(detalle);
  return Number.isSafeInteger(numero) ? numero : undefined;
}

function textoDeBusqueda(error: Record<string, unknown>): string {
  return [error.message, error.details, error.hint, error.constraint, error.constraint_name]
    .map(textoDe)
    .join(' ')
    .toLowerCase();
}

function mapear(error: unknown, ctx: MapDbErrorContext): CedularioErrorCode {
  if (ctx.timeout) return 'error_conexion';

  if (error === null || error === undefined) {
    return ctx.zeroRows ? 'sin_permisos' : 'error_generico';
  }

  if (!esObjeto(error)) return 'error_generico';

  const sqlstate = textoDe(error.code).trim().toUpperCase();

  if (sqlstate === '23505') {
    const texto = textoDeBusqueda(error);
    for (const [constraint, codigo] of CODIGO_POR_CONSTRAINT_UNICA) {
      if (texto.includes(constraint)) return codigo;
    }
    return 'error_generico';
  }

  const porSqlstate = sqlstate ? CODIGO_POR_SQLSTATE[sqlstate] : undefined;
  if (porSqlstate) return porSqlstate;

  if (esErrorDeRed(error)) return 'error_conexion';

  return 'error_generico';
}

/**
 * Maps any database, network or unknown error to a `CedularioErrorCode`.
 * Total: never throws, always returns a code that has an i18n key.
 */
export function mapDbError(error: unknown, ctx: MapDbErrorContext = {}): CedularioErrorCode {
  try {
    return mapear(error, ctx ?? {});
  } catch {
    return 'error_generico';
  }
}

/**
 * Same mapping, but returns the `ActionError` shape used by Server Actions.
 * For `23514` it also fills `fields` when `ctx.camposPorConstraint` names the field.
 * Total: never throws.
 */
export function toActionError(error: unknown, ctx: MapDbErrorContext = {}): ActionError {
  try {
    const code = mapDbError(error, ctx);
    const resultado: ActionError = { code };
    if (ctx?.params) resultado.params = ctx.params;

    if (code === 'cedulario_con_asignaciones') {
      const conteo = leerConteoDeDetalles(error);
      if (conteo !== undefined) resultado.params = { ...resultado.params, count: conteo };
    }

    if (code === 'validacion' && esObjeto(error) && ctx?.camposPorConstraint) {
      const texto = textoDeBusqueda(error);
      for (const [constraint, campo] of Object.entries(ctx.camposPorConstraint)) {
        if (texto.includes(constraint.toLowerCase())) {
          resultado.fields = { [campo]: 'validacion' };
          break;
        }
      }
    }
    return resultado;
  } catch {
    return { code: 'error_generico' };
  }
}
