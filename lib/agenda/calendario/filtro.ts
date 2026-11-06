/**
 * Slice `calendario` — estado del Filtro_Agenda (Requisito 12.3).
 *
 * El filtro controla qué se ve en la interfaz del calendario. Su estado vive en
 * la URL y es de presentación pura: no modifica los datos persistidos ni las
 * peticiones al servidor.
 *
 * Query params:
 *   - `agenda`: tipos visibles, `"cla,per,act"`. Cada abreviatura presente indica
 *     que ese tipo está activo. Con los tres activos el param no se añade.
 *   - `prof`: ids de profesores/admins seleccionados, separados por coma.
 *   - `alu`: ids de alumnos seleccionados, separados por coma.
 *
 * Una lista de personas vacía significa «sin filtrar» (se ve a todos).
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface FiltroAgenda {
  clases: boolean;
  entradasPersonales: boolean;
  actividades: boolean;
  /** Ids de profesores/admins seleccionados. Vacío = todos. */
  profesores: string[];
  /** Ids de alumnos seleccionados. Vacío = todos. */
  alumnos: string[];
}

/** Valores crudos de los query params del filtro. */
export interface ParamsFiltroAgenda {
  agenda: string | null;
  prof: string | null;
  alu: string | null;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

export const FILTRO_POR_DEFECTO: FiltroAgenda = {
  clases: true,
  entradasPersonales: true,
  actividades: true,
  profesores: [],
  alumnos: [],
};

export const PARAM_TIPOS = 'agenda';
export const PARAM_PROFESORES = 'prof';
export const PARAM_ALUMNOS = 'alu';

// ─── Mapeo de abreviaturas ──────────────────────────────────────────────────

const ABREV_CLASES = 'cla';
const ABREV_ENTRADAS = 'per';
const ABREV_ACTIVIDADES = 'act';

const ABREVIATURAS_VALIDAS = new Set([ABREV_CLASES, ABREV_ENTRADAS, ABREV_ACTIVIDADES]);

/** Ids de perfil: uuid o similares. Descarta cualquier otro carácter. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

// ─── Parseo / serialización ─────────────────────────────────────────────────

function parsearIds(valor: string | null): string[] {
  if (!valor) return [];
  const ids = valor
    .split(',')
    .map((id) => id.trim())
    .filter((id) => ID_VALIDO.test(id));
  return [...new Set(ids)];
}

function serializarIds(ids: string[]): string | null {
  const unicos = [...new Set(ids.filter((id) => ID_VALIDO.test(id)))];
  return unicos.length > 0 ? unicos.join(',') : null;
}

/**
 * Parsea los query params del filtro a un `FiltroAgenda`.
 *
 * - `agenda` nulo, vacío o sin ninguna abreviatura reconocida → los tres tipos activos.
 * - Abreviaturas válidas → solo los tipos listados están activos.
 * - `prof` / `alu` → ids válidos, sin duplicados.
 */
export function parsearFiltro(
  valor: string | null,
  profesores: string | null = null,
  alumnos: string | null = null,
): FiltroAgenda {
  const tokens = (valor ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => ABREVIATURAS_VALIDAS.has(t));

  const tiposPorDefecto = tokens.length === 0;

  return {
    clases: tiposPorDefecto || tokens.includes(ABREV_CLASES),
    entradasPersonales: tiposPorDefecto || tokens.includes(ABREV_ENTRADAS),
    actividades: tiposPorDefecto || tokens.includes(ABREV_ACTIVIDADES),
    profesores: parsearIds(profesores),
    alumnos: parsearIds(alumnos),
  };
}

/**
 * Serializa solo los tipos al formato del query param `agenda`.
 *
 * - Con los tres tipos activos devuelve `null` para que el param no aparezca.
 * - Si no hay ningún tipo activo devuelve `""`: `parsearFiltro` lo interpreta
 *   como «por defecto», así que el llamante debe impedir ese estado (ver
 *   `alternarTipo`).
 */
export function serializarFiltro(filtro: FiltroAgenda): string | null {
  const esPorDefecto =
    filtro.clases && filtro.entradasPersonales && filtro.actividades;

  if (esPorDefecto) {
    return null;
  }

  const partes: string[] = [];
  if (filtro.clases) partes.push(ABREV_CLASES);
  if (filtro.entradasPersonales) partes.push(ABREV_ENTRADAS);
  if (filtro.actividades) partes.push(ABREV_ACTIVIDADES);

  return partes.join(',');
}

/** Serializa el filtro completo a los tres query params (`null` = quitar el param). */
export function serializarFiltroCompleto(filtro: FiltroAgenda): ParamsFiltroAgenda {
  return {
    agenda: serializarFiltro(filtro),
    prof: serializarIds(filtro.profesores),
    alu: serializarIds(filtro.alumnos),
  };
}

// ─── Operaciones sobre el filtro ────────────────────────────────────────────

export type ClaveTipoFiltro = 'clases' | 'entradasPersonales' | 'actividades';

/**
 * Cuenta cuántos filtros están alterando la vista: tipos ocultos más personas
 * seleccionadas.
 */
export function contarFiltrosActivos(filtro: FiltroAgenda): number {
  const ocultos = [filtro.clases, filtro.entradasPersonales, filtro.actividades].filter(
    (visible) => !visible,
  ).length;
  return ocultos + filtro.profesores.length + filtro.alumnos.length;
}

/** Agrega el id si no está, lo quita si ya estaba. */
export function alternarId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * Activa o desactiva un tipo. Si el cambio dejaría los tres tipos ocultos, lo
 * ignora: ese estado no se puede representar en la URL (se leería como «todos»)
 * y dejaría el calendario vacío sin explicación.
 */
export function alternarTipo(filtro: FiltroAgenda, clave: ClaveTipoFiltro): FiltroAgenda {
  const siguiente = { ...filtro, [clave]: !filtro[clave] };
  const algunoVisible = siguiente.clases || siguiente.entradasPersonales || siguiente.actividades;
  return algunoVisible ? siguiente : filtro;
}

// ─── Reglas de visibilidad ──────────────────────────────────────────────────
//
// Cada lista de personas filtra a su propia población:
//   - `profesores` acota clases, bloqueos y eventos creados por profesores/admins.
//   - `alumnos` acota clases y eventos creados por alumnos.
// Los bloqueos son disponibilidad del profesor, así que se ocultan cuando se
// filtra por alumnos.

/** ¿Debe mostrarse esta clase? Se combinan ambas listas (AND). */
export function claseVisible(
  filtro: FiltroAgenda,
  clase: { profesorId: string; alumnoId: string | null },
): boolean {
  if (!filtro.clases) return false;
  if (filtro.profesores.length > 0 && !filtro.profesores.includes(clase.profesorId)) {
    return false;
  }
  if (filtro.alumnos.length > 0 && (!clase.alumnoId || !filtro.alumnos.includes(clase.alumnoId))) {
    return false;
  }
  return true;
}

/** ¿Debe mostrarse este bloqueo de horario? */
export function bloqueoVisible(filtro: FiltroAgenda, profesorId: string): boolean {
  if (filtro.alumnos.length > 0) return false;
  return filtro.profesores.length === 0 || filtro.profesores.includes(profesorId);
}

/** Forma mínima de un evento de agenda que necesita el filtro. */
export interface EventoAgendaFiltrable {
  tipo: 'entrada_personal' | 'actividad';
  autor: { id: string; rol: string };
}

/** ¿Debe mostrarse este evento de agenda (entrada personal o actividad)? */
export function eventoAgendaVisible(
  filtro: FiltroAgenda,
  evento: EventoAgendaFiltrable,
): boolean {
  if (evento.tipo === 'entrada_personal' && !filtro.entradasPersonales) return false;
  if (evento.tipo === 'actividad' && !filtro.actividades) return false;

  const seleccion = evento.autor.rol === 'alumno' ? filtro.alumnos : filtro.profesores;
  return seleccion.length === 0 || seleccion.includes(evento.autor.id);
}
