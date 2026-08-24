/**
 * Slice `compartido` — `ErrorAgenda` y su traducción a HTTP (Requisitos 15.1, 15.5, 17.1).
 *
 * Todos los errores de la agenda atraviesan el mismo camino: el servicio devuelve
 * `fallo(new ErrorAgenda(codigo, { campo }))`, el route handler lo convierte con
 * `respuestaError` y el cliente resuelve `mensajeKey` con next-intl. Un código nuevo
 * se añade en un solo sitio: la unión `CodigoErrorAgenda` y el mapa `ESTADOS`.
 *
 * El servidor NUNCA devuelve prosa traducida: solo la clave i18n (Requisito 15.5).
 *
 * Dependencias: `zod` solo por el tipo del error (`import type`, cero runtime) y
 * `./tiempo`, del mismo slice. Nada del proyecto (Requisito 17.3).
 */
import type { ZodError } from 'zod';

import { normalizarHora } from './tiempo';

/** Los 17 códigos de error de la agenda. */
export type CodigoErrorAgenda =
  | 'sin_sesion' | 'sin_permiso' | 'no_encontrado'
  | 'titulo_invalido' | 'rango_invalido' | 'horas_requeridas'
  | 'categoria_invalida' | 'lugar_excede'
  | 'enlace_invalido' | 'enlace_excede'
  | 'alcance_invalido' | 'alcance_sin_destinatarios' | 'destinatarios_invalidos'
  | 'alumno_no_asignado' | 'solapamiento_bloqueante'
  | 'no_es_actividad' | 'no_es_destinatario';

/**
 * Elemento en conflicto que acompaña a un 409. Es la misma forma que la
 * `AdvertenciaSolapamiento` del slice `nucleo`; se declara aquí porque `compartido`
 * no puede importar `nucleo`, y `nucleo` la alía sobre este tipo para que exista una
 * sola definición estructural en todo el código.
 */
export interface ConflictoAgenda {
  tipo: 'clase' | 'bloqueo_horario' | 'entrada_personal' | 'actividad';
  id: string;
  titulo: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  /** `HH:MM` */
  hora_inicio: string;
  /** `HH:MM` */
  hora_fin: string;
}

/** Cuerpo de toda respuesta de error de la API_Agenda. */
export interface CuerpoErrorAgenda {
  error: {
    codigo: CodigoErrorAgenda;
    /** Clave de next-intl, p. ej. `agendaNucleo.errores.titulo_invalido`. */
    mensajeKey: string;
    /** Campo que incumple, cuando aplica (Requisitos 3.9, 10.12). */
    campo?: string;
    /** Solo en el 409 (Requisito 6.2). */
    conflictos?: ConflictoAgenda[];
  };
}

/** Código HTTP de cada código de error. Única fuente de la traducción. */
export const ESTADOS: Record<CodigoErrorAgenda, number> = {
  sin_sesion: 401,
  sin_permiso: 403,
  alumno_no_asignado: 403,
  no_es_destinatario: 403,
  no_encontrado: 404,
  solapamiento_bloqueante: 409,
  titulo_invalido: 400,
  rango_invalido: 400,
  horas_requeridas: 400,
  categoria_invalida: 400,
  lugar_excede: 400,
  enlace_invalido: 400,
  enlace_excede: 400,
  alcance_invalido: 400,
  alcance_sin_destinatarios: 400,
  destinatarios_invalidos: 400,
  no_es_actividad: 400,
};

/**
 * Namespace i18n por defecto de `mensajeKey`. Cada slice pasa el suyo
 * (`agendaConexion`, `agendaActividades`, …) para cumplir el Requisito 17.10; los
 * códigos del modelo y el `sin_sesion` común viven en `agendaNucleo`.
 */
export const NAMESPACE_ERROR_POR_DEFECTO = 'agendaNucleo';

/** Máximo de conflictos que viaja en un 409 (Requisitos 6.2, 6.7). */
const TOPE_CONFLICTOS = 10;

const CODIGOS = new Set<string>(Object.keys(ESTADOS));

const TIPOS_CONFLICTO = new Set<string>([
  'clase', 'bloqueo_horario', 'entrada_personal', 'actividad',
]);

function esCodigoErrorAgenda(valor: unknown): valor is CodigoErrorAgenda {
  return typeof valor === 'string' && CODIGOS.has(valor);
}

export interface OpcionesErrorAgenda {
  /** Campo del formulario que incumple. */
  campo?: string;
  /** Elementos en conflicto; solo tiene sentido en `solapamiento_bloqueante`. */
  conflictos?: ConflictoAgenda[];
  /** Namespace i18n con el que se construye `mensajeKey`. */
  namespace?: string;
  /** Error original, cuando este `ErrorAgenda` envuelve otro. */
  causa?: unknown;
}

/**
 * Error de dominio de la agenda. El `message` de `Error` es el propio código: sirve
 * para las trazas de servidor y **nunca** se muestra al usuario.
 */
export class ErrorAgenda extends Error {
  readonly codigo: CodigoErrorAgenda;
  readonly campo?: string;
  readonly conflictos?: ConflictoAgenda[];
  readonly namespace?: string;
  readonly causa?: unknown;

  constructor(codigo: CodigoErrorAgenda, opciones: OpcionesErrorAgenda = {}) {
    super(codigo);
    this.name = 'ErrorAgenda';
    this.codigo = codigo;
    if (opciones.campo !== undefined) this.campo = opciones.campo;
    if (opciones.conflictos !== undefined) this.conflictos = opciones.conflictos;
    if (opciones.namespace !== undefined) this.namespace = opciones.namespace;
    if (opciones.causa !== undefined) this.causa = opciones.causa;
  }
}

/** `true` cuando el valor es un `ErrorAgenda`, sin depender de `instanceof` cruzado. */
export function esErrorAgenda(valor: unknown): valor is ErrorAgenda {
  return valor instanceof ErrorAgenda;
}

/** Código HTTP del error. Un código desconocido en tiempo de ejecución cae en 400. */
export function aEstadoHttp(error: ErrorAgenda): number {
  return ESTADOS[error.codigo] ?? 400;
}

/**
 * Clave i18n del error: `<namespace>.errores.<codigo>`. El namespace del propio
 * error gana sobre el argumento, y el argumento sobre el valor por defecto.
 */
export function mensajeKeyError(
  error: ErrorAgenda,
  namespace: string = NAMESPACE_ERROR_POR_DEFECTO,
): string {
  return `${error.namespace ?? namespace}.errores.${error.codigo}`;
}

/**
 * Campo del primer issue de Zod. Se descartan las claves simbólicas porque
 * `Array.prototype.join` lanza sobre un `symbol`.
 */
function campoDeRuta(ruta: readonly PropertyKey[]): string | undefined {
  const segmentos = ruta
    .filter((parte): parte is string | number => typeof parte === 'string' || typeof parte === 'number')
    .map(String);

  return segmentos.length > 0 ? segmentos.join('.') : undefined;
}

/**
 * Mapeo de respaldo campo → código, para los esquemas que no fijan el código como
 * mensaje. Cubre los campos del modelo de la agenda.
 */
const CODIGO_POR_CAMPO: Record<string, CodigoErrorAgenda> = {
  titulo: 'titulo_invalido',
  fecha: 'rango_invalido',
  hora_inicio: 'horas_requeridas',
  hora_fin: 'rango_invalido',
  categoria: 'categoria_invalida',
  lugar: 'lugar_excede',
  enlace_conexion: 'enlace_invalido',
  alcance: 'alcance_invalido',
  destinatarios: 'destinatarios_invalidos',
  destinatario_ids: 'destinatarios_invalidos',
};

export interface OpcionesDesdeZod {
  /** Namespace i18n del slice que valida. */
  namespace?: string;
  /** Código cuando ni el mensaje ni el campo permiten deducirlo. */
  porDefecto?: CodigoErrorAgenda;
}

/**
 * Convierte un `ZodError` en `ErrorAgenda` usando el primer issue.
 *
 * Resolución del código, en este orden:
 *  1. el `message` del issue, cuando el esquema fijó ahí un `CodigoErrorAgenda`
 *     (`z.string().max(200, 'lugar_excede')`) — es la vía que usan los esquemas de
 *     la agenda, para que el código viva junto a la regla que lo produce;
 *  2. el mapa de respaldo campo → código;
 *  3. `porDefecto`.
 *
 * Nunca se propaga el `message` de Zod al cliente: sería prosa del servidor
 * (Requisito 15.5).
 */
export function desdeZod(error: ZodError, opciones: OpcionesDesdeZod = {}): ErrorAgenda {
  const issue = error.issues[0];
  const campo = issue ? campoDeRuta(issue.path) : undefined;

  const codigo: CodigoErrorAgenda = esCodigoErrorAgenda(issue?.message)
    ? issue.message
    : (campo !== undefined ? CODIGO_POR_CAMPO[campo] : undefined)
      ?? opciones.porDefecto
      ?? 'rango_invalido';

  return new ErrorAgenda(codigo, {
    ...(campo !== undefined ? { campo } : {}),
    ...(opciones.namespace !== undefined ? { namespace: opciones.namespace } : {}),
    causa: error,
  });
}

/** Subconjunto de `PostgrestError` que necesita la traducción. */
export interface ErrorPostgrestParcial {
  code?: string | null;
  message?: string | null;
  /** El `DETAIL` del `RAISE`; en el `PT409` lleva el JSON de conflictos. */
  details?: string | null;
  hint?: string | null;
}

/** `SQLSTATE` que levantan los RPC de agenda → código de error de la agenda. */
const CODIGO_POR_SQLSTATE: Record<string, CodigoErrorAgenda> = {
  PT401: 'sin_sesion',
  PT400: 'rango_invalido',
  PT404: 'no_encontrado',
  PT409: 'solapamiento_bloqueante',
};

function aConflicto(valor: unknown): ConflictoAgenda | null {
  if (typeof valor !== 'object' || valor === null) return null;

  const fila = valor as Record<string, unknown>;
  const { tipo, id, titulo, fecha, hora_inicio: horaInicio, hora_fin: horaFin } = fila;

  if (typeof tipo !== 'string' || !TIPOS_CONFLICTO.has(tipo)) return null;
  if (typeof id !== 'string' || typeof fecha !== 'string') return null;
  if (typeof horaInicio !== 'string' || typeof horaFin !== 'string') return null;

  return {
    tipo: tipo as ConflictoAgenda['tipo'],
    id,
    titulo: typeof titulo === 'string' ? titulo : '',
    fecha,
    hora_inicio: normalizarHora(horaInicio),
    hora_fin: normalizarHora(horaFin),
  };
}

/**
 * Parsea el `DETAIL` del `PT409`: un array JSON de hasta 10 conflictos. Un `DETAIL`
 * ausente o corrupto devuelve una lista vacía en lugar de lanzar: el 409 sigue
 * siendo correcto aunque el cliente se quede sin la lista accionable.
 */
export function parsearConflictosPostgrest(detalle: string | null | undefined): ConflictoAgenda[] {
  if (!detalle) return [];

  let crudo: unknown;
  try {
    crudo = JSON.parse(detalle);
  } catch {
    return [];
  }

  if (!Array.isArray(crudo)) return [];

  return crudo
    .map(aConflicto)
    .filter((conflicto): conflicto is ConflictoAgenda => conflicto !== null)
    .slice(0, TOPE_CONFLICTOS);
}

/**
 * Traduce el error de un RPC de agenda a `ErrorAgenda`.
 *
 * Devuelve `null` cuando el `SQLSTATE` no es uno de los cuatro que levantan los RPC
 * de la agenda: un fallo de base de datos genuino no es un error de dominio y no
 * tiene código en esta tabla, así que el llamador debe propagarlo como 500 en lugar
 * de disfrazarlo con un código de la agenda.
 */
export function desdeErrorPostgrest(
  error: ErrorPostgrestParcial | null | undefined,
  opciones: { namespace?: string } = {},
): ErrorAgenda | null {
  const codigo = error?.code ? CODIGO_POR_SQLSTATE[error.code] : undefined;
  if (!codigo) return null;

  const conflictos = codigo === 'solapamiento_bloqueante'
    ? parsearConflictosPostgrest(error?.details)
    : undefined;

  return new ErrorAgenda(codigo, {
    ...(conflictos !== undefined ? { conflictos } : {}),
    ...(opciones.namespace !== undefined ? { namespace: opciones.namespace } : {}),
    causa: error,
  });
}

/** Cuerpo serializable del error, sin prosa: solo el código y la clave i18n. */
export function cuerpoError(
  error: ErrorAgenda,
  namespace: string = NAMESPACE_ERROR_POR_DEFECTO,
): CuerpoErrorAgenda {
  return {
    error: {
      codigo: error.codigo,
      mensajeKey: mensajeKeyError(error, namespace),
      ...(error.campo !== undefined ? { campo: error.campo } : {}),
      ...(error.conflictos !== undefined ? { conflictos: error.conflictos } : {}),
    },
  };
}

/**
 * Respuesta HTTP del error: el estado sale de `aEstadoHttp` y el cuerpo de
 * `cuerpoError`. Se construye un `Response` estándar —del que `NextResponse` es una
 * subclase— para no importar `next/server` en el nivel 0 del grafo.
 */
export function respuestaError(
  error: ErrorAgenda,
  opciones: { namespace?: string } = {},
): Response {
  return new Response(
    JSON.stringify(cuerpoError(error, opciones.namespace ?? NAMESPACE_ERROR_POR_DEFECTO)),
    {
      status: aEstadoHttp(error),
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  );
}
