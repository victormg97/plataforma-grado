/**
 * Slice `nucleo` — conversión `Row <-> DTO` de `agenda_eventos` (Requisitos 8.10,
 * 10.10, 10.11, 17.1, 17.2).
 *
 * Dos responsabilidades, y ninguna más:
 *
 *  - `Row -> DTO`: Postgres devuelve `TIME` como `HH:MM:SS` y toda la agenda trabaja
 *    con `HH:MM`, así que las horas pasan por `normalizarHora`. Aquí también se
 *    deriva `tipo` a partir de `alcance` y se elige la variante de lectura.
 *  - `DTO -> Row`: los campos comunes de una escritura, con el rango de día completo
 *    aplicado en un único punto (Requisito 10.10).
 *
 * Ninguna función de este archivo consulta la base de datos. Los datos que no están
 * en la fila —el `AutorResumen`, `puede_editar` y `oculto`— llegan como parámetros,
 * porque son la conclusión de reglas que viven en otros slices (`visibilidad`,
 * `ocultacion`) y el modelo no debe conocerlas.
 */
import { RANGO_DIA_COMPLETO, normalizarHora } from '@/lib/agenda/compartido';
import type {
  AgendaAlcance,
  AgendaEvento,
  AgendaVisibilidad,
  CategoriaAgenda,
  TablesInsert,
} from '@/lib/supabase/types';

import type {
  AutorResumen,
  EventoAgendaAjeno,
  EventoAgendaBase,
  EventoAgendaPropio,
  TipoEventoAgenda,
} from './tipos';

/** Fila de `agenda_eventos` tal como la devuelve Supabase. */
export type FilaEventoAgenda = AgendaEvento;

/**
 * Fila sin los dos campos de texto libre. Es el parámetro de la proyección parcial:
 * así el repositorio puede seleccionar menos columnas para los eventos ajenos y el
 * tipo sigue encajando (Requisito 8.10).
 */
export type FilaEventoAgendaSinTextoLibre = Omit<
  FilaEventoAgenda,
  'descripcion' | 'nota'
>;

/**
 * Lo que el mapeo no puede deducir de la fila. Se pasa explícitamente para que el
 * modelo no tenga que consultar `profiles`, las asignaciones de alumnos ni las
 * ocultaciones.
 */
export interface ContextoEventoAgenda {
  autor: AutorResumen;
  /** Requisito 12.5: ya resuelto en el servidor, nunca recalculado en el cliente. */
  puede_editar: boolean;
  /** Requisito 9.3: `false` para todo lector que no sea el Alumno destinatario. */
  oculto: boolean;
}

/**
 * `personal` es una Entrada_Personal; `alumnos_seleccionados` y `todos_alumnos` son
 * Actividades. Es la única traducción de alcance a tipo del proyecto.
 */
export function tipoDesdeAlcance(alcance: AgendaAlcance): TipoEventoAgenda {
  return alcance === 'personal' ? 'entrada_personal' : 'actividad';
}

/**
 * Rango horario del DTO. Un evento de día completo devuelve `00:00`–`23:59` sin mirar
 * las columnas (Requisito 10.10): la base de datos ya las guarda así, y resolverlo
 * también aquí evita que una fila antigua o escrita por otra vía se presente con un
 * rango incoherente con su propio indicador.
 */
function rangoDeFila(fila: {
  dia_completo: boolean;
  hora_inicio: string;
  hora_fin: string;
}): { hora_inicio: string; hora_fin: string } {
  if (fila.dia_completo) {
    return {
      hora_inicio: RANGO_DIA_COMPLETO.hora_inicio,
      hora_fin: RANGO_DIA_COMPLETO.hora_fin,
    };
  }

  return {
    hora_inicio: normalizarHora(fila.hora_inicio),
    hora_fin: normalizarHora(fila.hora_fin),
  };
}

/** Campos comunes a las dos variantes de lectura. */
function aBase(
  fila: FilaEventoAgendaSinTextoLibre,
  contexto: ContextoEventoAgenda,
): EventoAgendaBase {
  return {
    id: fila.id,
    tipo: tipoDesdeAlcance(fila.alcance),
    titulo: fila.titulo,
    categoria: fila.categoria,
    alcance: fila.alcance,
    visibilidad: fila.visibilidad,
    fecha: fila.fecha,
    ...rangoDeFila(fila),
    dia_completo: fila.dia_completo,
    lugar: fila.lugar,
    enlace_conexion: fila.enlace_conexion,
    autor: contexto.autor,
    puede_editar: contexto.puede_editar,
    oculto: contexto.oculto,
  };
}

/**
 * `Row -> DTO` de lectura completa: el lector es el Autor o un Destinatario_Vigente,
 * así que el DTO incluye `descripcion` y `nota` (Requisitos 8.9, 4.2).
 */
export function aEventoAgendaPropio(
  fila: FilaEventoAgenda,
  contexto: ContextoEventoAgenda,
): EventoAgendaPropio {
  return {
    ...aBase(fila, contexto),
    lectura: 'completa',
    descripcion: fila.descripcion,
    nota: fila.nota,
  };
}

/**
 * `Row -> DTO` de lectura parcial (Requisito 8.10). El objeto se construye desde
 * `aBase`, que no copia `descripcion` ni `nota`: las dos propiedades **no existen**
 * en el resultado, ni siquiera con valor `null`. Un `null` explícito ya sería una
 * fuga, porque revelaría que el campo está vacío.
 */
export function aEventoAgendaAjeno(
  fila: FilaEventoAgendaSinTextoLibre,
  contexto: ContextoEventoAgenda,
): EventoAgendaAjeno {
  return {
    ...aBase(fila, contexto),
    lectura: 'parcial',
  };
}

/**
 * Campos de escritura comunes a las Entradas_Personales y a las Actividades, tal como
 * salen de los esquemas Zod de los slices de capacidad.
 *
 * Las horas son opcionales porque un evento de día completo no las aporta (Requisito
 * 5.7): `aFilaEventoAgenda` las rellena con el rango de día completo.
 */
export interface CamposEscrituraAgenda {
  titulo: string;
  fecha: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  dia_completo?: boolean;
  categoria?: CategoriaAgenda;
  visibilidad?: AgendaVisibilidad;
  descripcion?: string | null;
  nota?: string | null;
  lugar?: string | null;
  enlace_conexion?: string | null;
}

/**
 * `DTO -> Row`: la fila que se inserta o se actualiza en `agenda_eventos`.
 *
 * `creador_id` llega del contexto de servidor, nunca del cuerpo de la solicitud
 * (Requisito 14.12), y el `alcance` lo fija la ruta: la de Entradas_Personales solo
 * admite `personal` (Requisito 3.3).
 *
 * Cuando `dia_completo` es `true`, las horas recibidas se descartan y se persiste el
 * rango `00:00`–`23:59` (Requisito 10.10). Cuando es `false`, las horas son
 * obligatorias y el esquema Zod del slice de capacidad ya las ha exigido; si aun así
 * faltaran, se persiste el rango de día completo antes que un `undefined` que la
 * restricción `NOT NULL` rechazaría con un error opaco.
 */
export function aFilaEventoAgenda(
  campos: CamposEscrituraAgenda,
  contexto: { creador_id: string; alcance: AgendaAlcance },
): TablesInsert<'agenda_eventos'> {
  const diaCompleto = campos.dia_completo ?? false;

  const horaInicio = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_inicio
    : normalizarHora(campos.hora_inicio ?? RANGO_DIA_COMPLETO.hora_inicio);

  const horaFin = diaCompleto
    ? RANGO_DIA_COMPLETO.hora_fin
    : normalizarHora(campos.hora_fin ?? RANGO_DIA_COMPLETO.hora_fin);

  return {
    creador_id: contexto.creador_id,
    alcance: contexto.alcance,
    titulo: campos.titulo.trim(),
    fecha: campos.fecha,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    dia_completo: diaCompleto,
    ...(campos.categoria !== undefined ? { categoria: campos.categoria } : {}),
    ...(campos.visibilidad !== undefined ? { visibilidad: campos.visibilidad } : {}),
    descripcion: campos.descripcion ?? null,
    nota: campos.nota ?? null,
    lugar: campos.lugar ?? null,
    enlace_conexion: campos.enlace_conexion ?? null,
  };
}
